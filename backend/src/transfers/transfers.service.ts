import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Transfer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FISCAL_YEARS, fmtShort, pct } from '../common/bill-utils';

export type TransferStatus = 'transferred' | 'minutes_awaited';

export interface TransferRow {
  id: string;
  recipient: string;
  purpose: string;
  objectCode: string;
  fiscalYear: string;
  budgetCode: string | null;
  amount: number;
  orderDate: string | null;
  status: TransferStatus;
  utilized: number;
  remarks: string | null;
}

export type TransferInput = Omit<TransferRow, 'id'>;

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<TransferRow[]> {
    const rows = await this.prisma.transfer.findMany({
      orderBy: [{ recipient: 'asc' }, { orderDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(r => ({
      id: r.id,
      recipient: r.recipient,
      purpose: r.purpose,
      objectCode: r.objectCode,
      fiscalYear: r.fiscalYear,
      budgetCode: r.budgetCode,
      amount: r.amount,
      orderDate: r.orderDate ? r.orderDate.toISOString().split('T')[0] : null,
      status: r.status as TransferStatus,
      utilized: r.utilized,
      remarks: r.remarks,
    }));
  }

  async create(data: TransferInput): Promise<Transfer> {
    this.validateInput(data);
    this.validateDisbursedTransfer(data);
    if (data.utilized > data.amount) {
      throw new BadRequestException('Utilized amount cannot exceed the transferred amount.');
    }
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          ...data,
          orderDate: data.orderDate ? new Date(data.orderDate) : null,
        },
      });
      await this.applyBudgetImpact(tx, null, transfer);
      return transfer;
    });
  }

  async update(id: string, data: Partial<TransferInput>): Promise<Transfer> {
    this.validateInput(data);
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.transfer.findUniqueOrThrow({ where: { id } });
      const accountingFieldsChanged = [
        'status',
        'budgetCode',
        'fiscalYear',
        'objectCode',
        'amount',
        'orderDate',
      ].some((field) => Object.prototype.hasOwnProperty.call(data, field));
      if (accountingFieldsChanged) {
        this.validateDisbursedTransfer({
          status: data.status ?? previous.status as TransferStatus,
          budgetCode: data.budgetCode === undefined ? previous.budgetCode : data.budgetCode,
          fiscalYear: data.fiscalYear ?? previous.fiscalYear,
          orderDate: data.orderDate === undefined
            ? previous.orderDate?.toISOString().split('T')[0] ?? null
            : data.orderDate,
        });
      }
      if ((data.utilized ?? previous.utilized) > (data.amount ?? previous.amount)) {
        throw new BadRequestException('Utilized amount cannot exceed the transferred amount.');
      }
      if (data.utilized !== undefined) {
        const linkedBills = await tx.bill.aggregate({
          where: { transferId: id, cat: 'cleared' },
          _sum: { amount: true },
        });
        if (data.utilized < (linkedBills._sum.amount || 0)) {
          throw new BadRequestException('Utilized amount cannot be lower than linked cleared bills.');
        }
      }
      const transfer = await tx.transfer.update({
        where: { id },
        data: {
          ...data,
          ...(data.orderDate !== undefined && {
            orderDate: data.orderDate ? new Date(data.orderDate) : null,
          }),
        },
      });
      await this.applyBudgetImpact(tx, previous, transfer);
      return transfer;
    });
  }

  async remove(id: string): Promise<Transfer> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.transfer.findUniqueOrThrow({ where: { id } });
      const linkedBills = await tx.bill.count({ where: { transferId: id } });
      if (linkedBills > 0) {
        throw new BadRequestException('Remove or unlink the associated bills before deleting this transfer.');
      }
      await this.applyBudgetImpact(tx, previous, null);
      return tx.transfer.delete({ where: { id } });
    });
  }

  private validateInput(data: Partial<TransferInput>): void {
    if (data.fiscalYear !== undefined && !FISCAL_YEARS.includes(data.fiscalYear)) {
      throw new BadRequestException(`Unsupported fiscal year: ${data.fiscalYear}`);
    }
    if (data.budgetCode != null && !['A215', 'A224', 'A233'].includes(data.budgetCode)) {
      throw new BadRequestException(`Unsupported funding head: ${data.budgetCode}`);
    }
    if (data.status !== undefined && !['transferred', 'minutes_awaited'].includes(data.status)) {
      throw new BadRequestException(`Unsupported transfer status: ${data.status}`);
    }
    if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) {
      throw new BadRequestException('Transfer amount must be a non-negative number.');
    }
    if (data.utilized !== undefined && (!Number.isFinite(data.utilized) || data.utilized < 0)) {
      throw new BadRequestException('Utilized amount must be a non-negative number.');
    }
    if (data.orderDate && Number.isNaN(Date.parse(data.orderDate))) {
      throw new BadRequestException('Order date must be a valid date.');
    }
  }

  private validateDisbursedTransfer(
    transfer: Pick<TransferInput, 'status' | 'budgetCode' | 'fiscalYear' | 'orderDate'>,
  ): void {
    if (transfer.status !== 'transferred') return;
    if (!transfer.budgetCode) {
      throw new BadRequestException('Select a budget funding head for a transferred amount.');
    }
    if (!transfer.orderDate) {
      throw new BadRequestException('Enter the transfer date for a transferred amount.');
    }
  }

  private async applyBudgetImpact(
    tx: Prisma.TransactionClient,
    previous: Pick<Transfer, 'status' | 'budgetCode' | 'objectCode' | 'fiscalYear' | 'amount'> | null,
    current: Pick<Transfer, 'status' | 'budgetCode' | 'objectCode' | 'fiscalYear' | 'amount'> | null,
  ): Promise<void> {
    const oldImpact = this.budgetImpact(previous);
    const newImpact = this.budgetImpact(current);
    if (oldImpact) await this.adjustBudget(tx, oldImpact, -oldImpact.amount);
    if (newImpact) await this.adjustBudget(tx, newImpact, newImpact.amount);
  }

  private budgetImpact(transfer: Pick<Transfer, 'status' | 'budgetCode' | 'objectCode' | 'fiscalYear' | 'amount'> | null) {
    if (!transfer || transfer.status !== 'transferred' || !transfer.budgetCode) return null;
    const fields = { A215: 'exp215', A224: 'exp224', A233: 'exp233' } as const;
    const field = fields[transfer.budgetCode as keyof typeof fields];
    return field
      ? { fiscalYear: transfer.fiscalYear, code: transfer.objectCode, field, amount: transfer.amount }
      : null;
  }

  private async adjustBudget(
    tx: Prisma.TransactionClient,
    impact: { fiscalYear: string; code: string; field: 'exp215' | 'exp224' | 'exp233'; amount: number },
    amount: number,
  ): Promise<void> {
    await tx.budget.update({
      where: { fiscalYear_code: { fiscalYear: impact.fiscalYear, code: impact.code } },
      data: { [impact.field]: { increment: amount } },
    });
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
