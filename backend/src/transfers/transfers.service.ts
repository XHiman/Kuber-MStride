import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fmtShort, pct } from '../common/bill-utils';

export type TransferStatus = 'transferred' | 'minutes_awaited';

export interface TransferRow {
  id: string;
  recipient: string;
  purpose: string;
  objectCode: string;
  amount: number;
  orderDate: string | null;
  status: TransferStatus;
  utilized: number;
  remarks: string | null;
}

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<TransferRow[]> {
    const rows = await this.prisma.transfer.findMany({ orderBy: { amount: 'desc' } });
    return rows.map(r => ({
      id: r.id,
      recipient: r.recipient,
      purpose: r.purpose,
      objectCode: r.objectCode,
      amount: r.amount,
      orderDate: r.orderDate ? r.orderDate.toISOString().split('T')[0] : null,
      status: r.status as TransferStatus,
      utilized: r.utilized,
      remarks: r.remarks,
    }));
  }

  async create(data: Omit<TransferRow, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.prisma.transfer.create({
      data: {
        ...data,
        orderDate: data.orderDate ? new Date(data.orderDate) : null,
      },
    });
  }

  async update(id: string, data: Partial<Omit<TransferRow, 'id' | 'createdAt' | 'updatedAt'>>) {
    return this.prisma.transfer.update({
      where: { id },
      data: {
        ...data,
        ...(data.orderDate !== undefined && {
          orderDate: data.orderDate ? new Date(data.orderDate) : null,
        }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.transfer.delete({ where: { id } });
  }

  async getStats() {
    const rows = await this.findAll();
    const totalAmt = rows.reduce((s, r) => s + r.amount, 0);
    const totalUtil = rows.reduce((s, r) => s + r.utilized, 0);
    const pending = rows.filter(r => r.status === 'minutes_awaited').length;

    return {
      totalAmt,
      totalUtil,
      unutilized: totalAmt - totalUtil,
      utilizationPct: pct(totalUtil, totalAmt),
      pending,
      count: rows.length,
    };
  }
}
