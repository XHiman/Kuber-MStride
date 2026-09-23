import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bill } from '@prisma/client';
import { classifyStatus, daysPending, clearedFYOf } from '../common/bill-utils';

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
      _clearedFY: clearedFYOf(b.date),
    }));
  }

  async findOne(id: string): Promise<BillWithComputed | null> {
    const bill = await this.prisma.bill.findUnique({ where: { id } });
    if (!bill) return null;
    return {
      ...bill,
      date: bill.date ? bill.date.toISOString().split('T')[0] : null,
      _days: daysPending(bill.cat === 'cleared' ? null : bill.date),
      _clearedFY: clearedFYOf(bill.date),
    };
  }

  async create(
    data: Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'budgetCode' | 'objectHead'> &
      Partial<Pick<Bill, 'budgetCode' | 'objectHead'>>,
  ): Promise<Bill> {
    const cls = classifyStatus(data.status);
    return this.prisma.bill.create({
      data: { ...data, bucket: cls.bucket, cat: cls.cat },
    });
  }

  async update(id: string, data: Partial<Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Bill> {
    if (data.status) {
      const cls = classifyStatus(data.status);
      data.bucket = cls.bucket;
      data.cat = cls.cat;
    }
    return this.prisma.bill.update({ where: { id }, data });
  }

  async remove(id: string): Promise<Bill> {
    return this.prisma.bill.delete({ where: { id } });
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
    const pending = bills.filter(b => b._days).sort((a, c) => (c._days || 0) - (a._days || 0));
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
