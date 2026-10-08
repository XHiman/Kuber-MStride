import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bill, Prisma } from '@prisma/client';
import { classifyStatus, daysPending, clearedFYOf, extractClearDate, fiscalYearOf } from '../common/bill-utils';

export type BillCategory = 'cleared' | 'in_progress' | 'on_hold';

export interface BillWithComputed extends Omit<Bill, 'date'> {
  date: string | null;
  _days: number | null;
  _clearedFY: string | null;
  effectiveAmount: number;
  stageHistory: { id: string; stage: string; enteredAt: string; source: string }[];
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
      include: {
        stageHistory: { orderBy: { enteredAt: 'asc' } },
      },
    });

    return bills.map((b) => ({
      ...b,
      date: b.date ? b.date.toISOString().split('T')[0] : null,
      _days: daysPending(b.cat === 'cleared' ? null : b.date),
      _clearedFY: b.clearedFY || clearedFYOf(b.date),
      effectiveAmount: this.effectiveAmount(b),
      stageHistory: b.stageHistory.map(entry => ({
        id: entry.id,
        stage: entry.stage,
        enteredAt: entry.enteredAt.toISOString(),
        source: entry.source,
      })),
    }));
  }

  async findOne(id: string): Promise<BillWithComputed | null> {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: { stageHistory: { orderBy: { enteredAt: 'asc' } } },
    });
    if (!bill) return null;
    return {
      ...bill,
      date: bill.date ? bill.date.toISOString().split('T')[0] : null,
      _days: daysPending(bill.cat === 'cleared' ? null : bill.date),
      _clearedFY: bill.clearedFY || clearedFYOf(bill.date),
      effectiveAmount: this.effectiveAmount(bill),
      stageHistory: bill.stageHistory.map(entry => ({
        id: entry.id,
        stage: entry.stage,
        enteredAt: entry.enteredAt.toISOString(),
        source: entry.source,
      })),
    };
  }

  async create(
  data: Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'budgetCode' | 'objectHead' | 'transferId' | 'program' | 'district' | 'assignedUserId' | 'amountSanctioned' | 'onHold' | 'holdReason' | 'efileNumber'> &
    Partial<Pick<Bill, 'budgetCode' | 'objectHead' | 'transferId' | 'program' | 'district' | 'assignedUserId' | 'amountSanctioned' | 'onHold' | 'holdReason' | 'efileNumber'>>,
): Promise<Bill> {
  const cls = this.classifyBill(data.status, data.bucket);
  const onHold = data.onHold || data.cat === 'on_hold';
  this.validateSanctionedAmount(data.amountSanctioned, cls.bucket);
  this.validateHold(onHold, data.holdReason);

  return this.prisma.$transaction(async (tx) => {
    const bill = await tx.bill.create({
      data: {
        ...data,
        bucket: cls.bucket,
        cat: onHold ? 'on_hold' : cls.cat,
        onHold,
        holdReason: onHold ? data.holdReason?.trim() : null,
        clearedFY: cls.cat === 'cleared' ? this.clearanceFiscalYear(data.status) : null,
      },
    });
    await tx.billStageHistory.create({
      data: { billId: bill.id, stage: bill.bucket, source: 'created' },
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
  return this.prisma.$transaction(async (tx) => {
    const previous = await tx.bill.findUniqueOrThrow({ where: { id } });
    const classification = data.status || data.bucket
      ? this.classifyBill(data.status ?? previous.status, data.bucket ?? previous.bucket)
      : { bucket: previous.bucket, cat: (data.cat as BillCategory | undefined) ?? classifyStatus(previous.status).cat as BillCategory };
    const onHold = data.onHold ?? (previous.onHold || previous.cat === 'on_hold');
    const holdReason = onHold
      ? (data.holdReason ?? previous.holdReason)?.trim() || null
      : null;
    if (data.amountSanctioned !== undefined) {
      this.validateSanctionedAmount(data.amountSanctioned, classification.bucket);
    } else if (previous.amountSanctioned !== null) {
      this.validateSanctionedAmount(previous.amountSanctioned, classification.bucket, true);
    }
    this.validateHold(onHold, holdReason);
    const updateData: Prisma.BillUpdateInput = { ...data };
    updateData.bucket = classification.bucket;
    updateData.cat = onHold ? 'on_hold' : classification.cat;
    updateData.onHold = onHold;
    updateData.holdReason = holdReason;
    const nextCategory = updateData.cat;
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
    if (bill.bucket !== previous.bucket) {
      await tx.billStageHistory.create({
        data: { billId: bill.id, stage: bill.bucket },
      });
    }
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
    const changedTransferId = oldTransfer?.transferId !== newTransfer?.transferId;
    if (previous && (!newTransfer || changedTransferId)) {
      await tx.transferUtilization.deleteMany({ where: { billId: previous.id } });
    }
    if (current && newTransfer) {
      await tx.transferUtilization.upsert({
        where: { billId: current.id },
        create: {
          transferId: newTransfer.transferId,
          billId: current.id,
          amount: newTransfer.amount,
          utilizedAt: this.clearanceDate(current),
          remarks: `Cleared bill: ${current.vendor} / ${current.invoice}`,
        },
        update: {
          transferId: newTransfer.transferId,
          amount: newTransfer.amount,
          utilizedAt: this.clearanceDate(current),
          remarks: `Cleared bill: ${current.vendor} / ${current.invoice}`,
        },
      });
    }

    const transferIds = new Set([oldTransfer?.transferId, newTransfer?.transferId].filter(
      (transferId): transferId is string => Boolean(transferId),
    ));
    for (const transferId of transferIds) {
      const [previousTransfer, utilization] = await Promise.all([
        tx.transfer.findUniqueOrThrow({ where: { id: transferId } }),
        tx.transferUtilization.aggregate({ where: { transferId }, _sum: { amount: true } }),
      ]);
      const utilized = utilization._sum.amount || 0;
      if (utilized > previousTransfer.amount) {
        throw new BadRequestException('Cleared bill exceeds the remaining amount on its linked transfer.');
      }
      const transfer = await tx.transfer.update({ where: { id: transferId }, data: { utilized } });
      if (previousTransfer.utilized !== transfer.utilized) {
        await tx.transferHistory.create({
          data: {
            transferId,
            field: 'utilized',
            oldValue: String(previousTransfer.utilized),
            newValue: String(transfer.utilized),
          },
        });
      }
    }
  }

  private budgetImpact(bill: Bill | null) {
    if (!bill || bill.cat !== 'cleared' || bill.transferId || !bill.budgetCode || !bill.objectHead) return null;
    const fields = { A215: 'exp215', A224: 'exp224', A233: 'exp233' } as const;
    const field = fields[bill.budgetCode as keyof typeof fields];
    const fiscalYear = bill.clearedFY || fiscalYearOf(new Date());
    return field ? { code: bill.objectHead, field, amount: this.effectiveAmount(bill), fiscalYear } : null;
  }

  private transferImpact(bill: Bill | null) {
    if (!bill || bill.cat !== 'cleared' || !bill.transferId) return null;
    return { transferId: bill.transferId, amount: this.effectiveAmount(bill) };
  }

  private effectiveAmount(bill: Pick<Bill, 'amount' | 'amountSanctioned' | 'bucket'>): number {
    return bill.bucket === 'Cleared by Treasury' && bill.amountSanctioned !== null
      ? bill.amountSanctioned
      : bill.amount;
  }

  private clearanceDate(bill: Bill): Date {
    const clearDate = extractClearDate(bill.status);
    return clearDate
      ? new Date(Date.UTC(clearDate.y, clearDate.m - 1, clearDate.d))
      : new Date();
  }

  private validateSanctionedAmount(amount: number | null | undefined, bucket: string, keepExisting = false): void {
    if (amount === null || amount === undefined) return;
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Sanctioned amount must be a non-negative number.');
    }
    if (bucket !== 'Cleared by Treasury' && !keepExisting) {
      throw new BadRequestException('A sanctioned amount can only be entered at Cleared by Treasury.');
    }
  }

  private validateHold(onHold: boolean, reason: string | null | undefined): void {
    if (onHold && !reason?.trim()) {
      throw new BadRequestException('Enter a remark explaining why the bill is on hold.');
    }
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
    if (bucket === 'Cleared by Treasury' || classified.cat === 'cleared') {
      return { ...classified, bucket: 'Cleared by Treasury', cat: 'cleared' as const };
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
    const total = bills.reduce((s, b) => s + b.effectiveAmount, 0);
    const cleared = bills.filter(b => b.cat === 'cleared');
    const onHold = bills.filter(b => b.cat === 'on_hold');
    const inProgress = bills.filter(b => b.cat === 'in_progress');

    // Stage aggregation
    const stages: Record<string, { amount: number; count: number; onHold: number }> = {};
    for (const b of bills) {
      if (!stages[b.bucket]) stages[b.bucket] = { amount: 0, count: 0, onHold: 0 };
      stages[b.bucket].amount += b.effectiveAmount;
      stages[b.bucket].count += 1;
      if (b.cat === 'on_hold') stages[b.bucket].onHold += 1;
    }

    // Vendor aggregation
    const vendors: Record<string, { cleared: number; in_progress: number; on_hold: number; total: number; count: number }> = {};
    for (const b of bills) {
      if (!vendors[b.vendor]) vendors[b.vendor] = { cleared: 0, in_progress: 0, on_hold: 0, total: 0, count: 0 };
      const v = vendors[b.vendor];
      v.total += b.effectiveAmount;
      v.count += 1;
      v[b.cat] += b.effectiveAmount;
    }

    // Oldest pending
    const pending = bills
      .filter(b => b.cat !== 'cleared' && b.cat !== 'on_hold' && b._days !== null && b._days >= 0)
      .sort((a, c) => (c._days || 0) - (a._days || 0));
    const oldest = pending[0];

    return {
      total,
      cleared: { amount: cleared.reduce((s, b) => s + b.effectiveAmount, 0), count: cleared.length },
      inProgress: { amount: inProgress.reduce((s, b) => s + b.effectiveAmount, 0), count: inProgress.length },
      onHold: { amount: onHold.reduce((s, b) => s + b.effectiveAmount, 0), count: onHold.length },
      stages,
      vendors,
      oldestPending: oldest ? { vendor: oldest.vendor, days: oldest._days, amount: oldest.effectiveAmount } : null,
    };
  }
}
