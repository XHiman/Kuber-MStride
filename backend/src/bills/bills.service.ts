import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bill, Prisma } from '@prisma/client';
import { classifyStatus, daysPending, clearedFYOf, extractClearDate, fiscalYearOf } from '../common/bill-utils';

export type BillCategory = 'cleared' | 'in_progress' | 'on_hold';

export interface BillWithComputed extends Omit<Bill, 'date'> {
  date: string | null;
  _days: number | null;
  _clearedFY: string | null;
}

@Injectable()
export class BillsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: {
    search?: string;
    vendor?: string;
    stage?: string;
    cat?: BillCategory;
    clearedFY?: string;
    skip?: number;
    take?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<BillWithComputed[]> {
    const { search, vendor, stage, cat, clearedFY, skip = 0, take = 1000, sortBy = 'amount', sortDir = 'desc' } = params || {};

    const where: Record<string, unknown> = {};
    if (vendor) where.vendor = vendor;
    if (stage) where.bucket = stage;
    if (cat) where.cat = cat;
    if (search) {
      where.OR = [
        { vendor: { contains: search } },
        { invoice: { contains: search } },
        { status: { contains: search } },
      ];
    }

    const bills = await this.prisma.bill.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortDir },
    });

    return bills.map((b) => ({
      ...b,
      date: b.date ? b.date.toISOString().split('T')[0] : null,
      _days: daysPending(b.cat === 'cleared' ? null : b.date),
      _clearedFY: b.clearedFY || clearedFYOf(b.date),
    }));
  }

  async findOne(id: string): Promise<BillWithComputed | null> {
    const bill = await this.prisma.bill.findUnique({ where: { id } });
    if (!bill) return null;
    return {
      ...bill,
      date: bill.date ? bill.date.toISOString().split('T')[0] : null,
      _days: daysPending(bill.cat === 'cleared' ? null : bill.date),
      _clearedFY: bill.clearedFY || clearedFYOf(bill.date),
    };
  }

  async create(
  data: Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'budgetCode' | 'objectHead' | 'transferId'> &
    Partial<Pick<Bill, 'budgetCode' | 'objectHead' | 'transferId'>>,
): Promise<Bill> {
  const cls = this.classifyBill(data.status, data.bucket);

  return this.prisma.$transaction(async (tx) => {
    const bill = await tx.bill.create({
      data: {
        ...data,
        bucket: cls.bucket,
        cat: cls.cat,
        clearedFY: cls.cat === 'cleared' ? this.clearanceFiscalYear(data.status) : null,
      },
    });
    await this.applyFinancialImpact(tx, null, bill);
    return bill;
  });
}

  async update(
  id: string,
  data: Partial<Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'date'>> & {
    date?: Date | string | null;
  }
): Promise<Bill> {
  if (data.status || data.bucket) {
    const cls = this.classifyBill(data.status, data.bucket);
    data.bucket = cls.bucket;
    data.cat = cls.cat;
  }

  return this.prisma.$transaction(async (tx) => {
    const previous = await tx.bill.findUniqueOrThrow({ where: { id } });
    const updateData: Prisma.BillUpdateInput = { ...data };
    const nextCategory = data.cat || previous.cat;
    if (nextCategory === 'cleared') {
      updateData.clearedFY = previous.cat === 'cleared' && previous.clearedFY
        ? previous.clearedFY
        : this.clearanceFiscalYear(data.status || previous.status);
    } else {
      updateData.clearedFY = null;
    }
    if (data.date !== undefined) {
      updateData.date = data.date ? new Date(data.date) : null;
    } else {
      delete updateData.date;
    }
    const bill = await tx.bill.update({
      where: { id },
      data: updateData,
    });
    await this.applyFinancialImpact(tx, previous, bill);
    return bill;
  });
}

  private async applyFinancialImpact(
    tx: Prisma.TransactionClient,
    previous: Bill | null,
    current: Bill | null,
  ) {
    const oldBudget = this.budgetImpact(previous);
    const newBudget = this.budgetImpact(current);
    if (oldBudget) await this.adjustBudget(tx, oldBudget, -oldBudget.amount);
    if (newBudget) await this.adjustBudget(tx, newBudget, newBudget.amount);

    const oldTransfer = this.transferImpact(previous);
    const newTransfer = this.transferImpact(current);
    if (oldTransfer) {
      const transfer = await tx.transfer.update({
        where: { id: oldTransfer.transferId },
        data: { utilized: { decrement: oldTransfer.amount } },
      });
      if (transfer.utilized < 0) {
        throw new BadRequestException('Linked utilization is below the amount being removed from this transfer.');
      }
    }
    if (newTransfer) {
      const transfer = await tx.transfer.update({
        where: { id: newTransfer.transferId },
        data: { utilized: { increment: newTransfer.amount } },
      });
      if (transfer.utilized > transfer.amount) {
        throw new BadRequestException('Cleared bill exceeds the remaining amount on its linked transfer.');
      }
    }
  }

  private budgetImpact(bill: Bill | null) {
    if (!bill || bill.cat !== 'cleared' || bill.transferId || !bill.budgetCode || !bill.objectHead) return null;
    const fields = { A215: 'exp215', A224: 'exp224', A233: 'exp233' } as const;
    const field = fields[bill.budgetCode as keyof typeof fields];
    const fiscalYear = bill.clearedFY || fiscalYearOf(new Date());
    return field ? { code: bill.objectHead, field, amount: bill.amount, fiscalYear } : null;
  }

  private transferImpact(bill: Bill | null) {
    if (!bill || bill.cat !== 'cleared' || !bill.transferId) return null;
    return { transferId: bill.transferId, amount: bill.amount };
  }

  private async adjustBudget(
    tx: Prisma.TransactionClient,
    impact: { code: string; field: 'exp215' | 'exp224' | 'exp233'; amount: number; fiscalYear: string },
    amount: number,
  ) {
    await tx.budget.update({
      where: { fiscalYear_code: { fiscalYear: impact.fiscalYear, code: impact.code } },
      data: { [impact.field]: { increment: amount } },
    });
  }

  private classifyBill(status: string | undefined, bucket?: string) {
    const classified = classifyStatus(status);
    if (bucket === 'Treasury Clearance' || classified.cat === 'cleared') {
      return { ...classified, bucket: 'Treasury Clearance', cat: 'cleared' as const };
    }
    return { ...classified, bucket: bucket || classified.bucket };
  }

  private clearanceFiscalYear(status: string): string {
    const clearDate = extractClearDate(status);
    return clearDate
      ? fiscalYearOf(new Date(clearDate.y, clearDate.m - 1, clearDate.d))
      : fiscalYearOf(new Date());
  }

  async remove(id: string): Promise<Bill> {
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUniqueOrThrow({ where: { id } });
      await this.applyFinancialImpact(tx, bill, null);
      return tx.bill.delete({ where: { id } });
    });
  }

  // Dashboard aggregation
  async getDashboardStats() {
    const bills = await this.findAll();
    const total = bills.reduce((s, b) => s + b.amount, 0);
    const cleared = bills.filter(b => b.cat === 'cleared');
    const onHold = bills.filter(b => b.cat === 'on_hold');
    const inProgress = bills.filter(b => b.cat === 'in_progress');

    // Stage aggregation
    const stages: Record<string, { amount: number; count: number; onHold: number }> = {};
    for (const b of bills) {
      if (!stages[b.bucket]) stages[b.bucket] = { amount: 0, count: 0, onHold: 0 };
      stages[b.bucket].amount += b.amount;
      stages[b.bucket].count += 1;
      if (b.cat === 'on_hold') stages[b.bucket].onHold += 1;
    }

    // Vendor aggregation
    const vendors: Record<string, { cleared: number; in_progress: number; on_hold: number; total: number; count: number }> = {};
    for (const b of bills) {
      if (!vendors[b.vendor]) vendors[b.vendor] = { cleared: 0, in_progress: 0, on_hold: 0, total: 0, count: 0 };
      const v = vendors[b.vendor];
      v.total += b.amount;
      v.count += 1;
      v[b.cat] += b.amount;
    }

    // Oldest pending
    const pending = bills
      .filter(b => b.cat !== 'cleared' && b._days !== null && b._days >= 0)
      .sort((a, c) => (c._days || 0) - (a._days || 0));
    const oldest = pending[0];

    return {
      total,
      cleared: { amount: cleared.reduce((s, b) => s + b.amount, 0), count: cleared.length },
      inProgress: { amount: inProgress.reduce((s, b) => s + b.amount, 0), count: inProgress.length },
      onHold: { amount: onHold.reduce((s, b) => s + b.amount, 0), count: onHold.length },
      stages,
      vendors,
      oldestPending: oldest ? { vendor: oldest.vendor, days: oldest._days, amount: oldest.amount } : null,
    };
  }
}
