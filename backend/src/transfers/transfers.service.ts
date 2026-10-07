import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Transfer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FISCAL_YEARS, fmtShort, pct } from '../common/bill-utils';

export type TransferStatus = 'transferred' | 'minutes_awaited';
export type DistrictFund = 'incentive_funds' | 'consultants_grant';

export interface TransferUtilizationRow {
  id: string;
  amount: number;
  utilizedAt: string;
  remarks: string | null;
  billId: string | null;
}

export interface TransferRow {
  id: string;
  recipient: string;
  scopeType: 'program' | 'district' | null;
  districtFund: DistrictFund | null;
  purpose: string;
  objectCode: string;
  fiscalYear: string;
  budgetCode: string | null;
  amount: number;
  orderDate: string | null;
  status: TransferStatus;
  utilized: number;
  utilizations: TransferUtilizationRow[];
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  history: {
    changedAt: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[];
}

export type TransferInput = Omit<TransferRow, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'utilized' | 'utilizations'> & {
  utilized?: number;
  utilizationDate?: string | null;
};

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<TransferRow[]> {
    const rows = await this.prisma.transfer.findMany({
      orderBy: [{ recipient: 'asc' }, { orderDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        history: { orderBy: { changedAt: 'asc' } },
        utilizations: { orderBy: [{ utilizedAt: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    return rows.map(r => ({
      id: r.id,
      recipient: r.recipient,
      scopeType: r.scopeType as 'program' | 'district' | null,
      districtFund: r.districtFund as DistrictFund | null,
      purpose: r.purpose,
      objectCode: r.objectCode,
      fiscalYear: r.fiscalYear,
      budgetCode: r.budgetCode,
      amount: r.amount,
      orderDate: r.orderDate ? r.orderDate.toISOString().split('T')[0] : null,
      status: r.status as TransferStatus,
      utilized: r.utilized,
      utilizations: r.utilizations.map(entry => this.toUtilizationRow(entry)),
      remarks: r.remarks,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      history: r.history.map(entry => ({
        changedAt: entry.changedAt.toISOString(),
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      })),
    }));
  }

  async create(data: TransferInput): Promise<Transfer> {
    this.validateInput(data);
    this.validateDisbursedTransfer(data);
    if (data.scopeType === 'district' && !data.districtFund) {
      throw new BadRequestException('Choose Incentive Funds or Consultants Grant for a district transfer.');
    }
    const initialUtilized = data.utilized || 0;
    if (initialUtilized > data.amount) {
      throw new BadRequestException('Utilized amount cannot exceed the transferred amount.');
    }
    if (data.utilizationDate && Number.isNaN(Date.parse(data.utilizationDate))) {
      throw new BadRequestException('Utilization date must be a valid date.');
    }
    return this.prisma.$transaction(async (tx) => {
      const { utilized: _utilized, utilizationDate, ...transferData } = data;
      const transfer = await tx.transfer.create({
        data: {
          ...transferData,
          utilized: 0,
          orderDate: data.orderDate ? new Date(data.orderDate) : null,
        },
      });
      if (initialUtilized > 0) {
        await tx.transferUtilization.create({
          data: {
            transferId: transfer.id,
            amount: initialUtilized,
            utilizedAt: utilizationDate ? new Date(utilizationDate) : new Date(),
          },
        });
        transfer.utilized = initialUtilized;
        await tx.transfer.update({ where: { id: transfer.id }, data: { utilized: initialUtilized } });
      }
      await this.applyBudgetImpact(tx, null, transfer);
      await tx.transferHistory.create({
        data: {
          transferId: transfer.id,
          field: 'record-created',
          newValue: JSON.stringify({
            recipient: transfer.recipient,
            scopeType: transfer.scopeType,
            districtFund: transfer.districtFund,
            purpose: transfer.purpose,
            objectCode: transfer.objectCode,
            fiscalYear: transfer.fiscalYear,
            budgetCode: transfer.budgetCode,
            amount: transfer.amount,
            orderDate: transfer.orderDate?.toISOString() ?? null,
            status: transfer.status,
            utilized: transfer.utilized,
            remarks: transfer.remarks,
          }),
        },
      });
      return transfer;
    });
  }

  async update(id: string, data: Partial<TransferInput>): Promise<Transfer> {
    this.validateInput(data);
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.transfer.findUniqueOrThrow({ where: { id } });
      if (Object.prototype.hasOwnProperty.call(data, 'utilized') && data.utilized !== previous.utilized) {
        throw new BadRequestException('Edit utilization through dated utilization entries instead of changing the total.');
      }
      const nextScopeType = data.scopeType ?? previous.scopeType;
      const nextDistrictFund = data.districtFund === undefined ? previous.districtFund : data.districtFund;
      if (nextScopeType === 'district' && !nextDistrictFund) {
        throw new BadRequestException('Choose Incentive Funds or Consultants Grant for a district transfer.');
      }
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
      if (previous.utilized > (data.amount ?? previous.amount)) {
        throw new BadRequestException('Transferred amount cannot be lower than its utilization total.');
      }
      const { utilizationDate: _utilizationDate, utilized: _utilized, ...updateData } = data;
      const transfer = await tx.transfer.update({
        where: { id },
        data: {
          ...updateData,
          ...(data.orderDate !== undefined && {
            orderDate: data.orderDate ? new Date(data.orderDate) : null,
          }),
        },
      });
      await this.applyBudgetImpact(tx, previous, transfer);
      const changedFields = Object.keys(data).filter(field =>
        !this.valuesEqual(previous[field as keyof typeof previous], transfer[field as keyof typeof transfer]),
      );
      if (changedFields.length) {
        await tx.transferHistory.createMany({
          data: changedFields.map(field => ({
            transferId: transfer.id,
            field,
            oldValue: this.historyValue(previous[field as keyof typeof previous]),
            newValue: this.historyValue(transfer[field as keyof typeof transfer]),
          })),
        });
      }
      return transfer;
    });
  }

  async addUtilization(id: string, data: { amount: number; utilizedAt: string; remarks?: string | null }) {
    this.validateUtilization(data);
    return this.prisma.$transaction(async tx => {
      const transfer = await tx.transfer.findUniqueOrThrow({ where: { id } });
      const utilized = transfer.utilized + data.amount;
      if (utilized > transfer.amount) {
        throw new BadRequestException('Utilization cannot exceed the transferred amount.');
      }
      const entry = await tx.transferUtilization.create({
        data: {
          transferId: id,
          amount: data.amount,
          utilizedAt: new Date(data.utilizedAt),
          remarks: data.remarks?.trim() || null,
        },
      });
      await tx.transfer.update({ where: { id }, data: { utilized } });
      await tx.transferHistory.create({
        data: { transferId: id, field: 'utilized', oldValue: String(transfer.utilized), newValue: String(utilized) },
      });
      return this.toUtilizationRow(entry);
    });
  }

  async updateUtilization(
    transferId: string,
    utilizationId: string,
    data: { amount: number; utilizedAt: string; remarks?: string | null },
  ) {
    this.validateUtilization(data);
    return this.prisma.$transaction(async tx => {
      const [transfer, existing] = await Promise.all([
        tx.transfer.findUniqueOrThrow({ where: { id: transferId } }),
        tx.transferUtilization.findFirstOrThrow({ where: { id: utilizationId, transferId } }),
      ]);
      if (existing.billId) {
        throw new BadRequestException('Utilization linked to a cleared bill is changed by editing that bill.');
      }
      const utilized = transfer.utilized - existing.amount + data.amount;
      if (utilized > transfer.amount) {
        throw new BadRequestException('Utilization cannot exceed the transferred amount.');
      }
      const entry = await tx.transferUtilization.update({
        where: { id: utilizationId },
        data: {
          amount: data.amount,
          utilizedAt: new Date(data.utilizedAt),
          remarks: data.remarks?.trim() || null,
        },
      });
      await tx.transfer.update({ where: { id: transferId }, data: { utilized } });
      await tx.transferHistory.create({
        data: { transferId, field: 'utilized', oldValue: String(transfer.utilized), newValue: String(utilized) },
      });
      return this.toUtilizationRow(entry);
    });
  }

  async removeUtilization(transferId: string, utilizationId: string) {
    return this.prisma.$transaction(async tx => {
      const [transfer, existing] = await Promise.all([
        tx.transfer.findUniqueOrThrow({ where: { id: transferId } }),
        tx.transferUtilization.findFirstOrThrow({ where: { id: utilizationId, transferId } }),
      ]);
      if (existing.billId) {
        throw new BadRequestException('Utilization linked to a cleared bill is removed by editing that bill.');
      }
      const utilized = transfer.utilized - existing.amount;
      await tx.transferUtilization.delete({ where: { id: utilizationId } });
      await tx.transfer.update({ where: { id: transferId }, data: { utilized } });
      await tx.transferHistory.create({
        data: { transferId, field: 'utilized', oldValue: String(transfer.utilized), newValue: String(utilized) },
      });
      return { success: true };
    });
  }

  private toUtilizationRow(entry: {
    id: string;
    amount: number;
    utilizedAt: Date;
    remarks: string | null;
    billId: string | null;
  }): TransferUtilizationRow {
    return {
      id: entry.id,
      amount: entry.amount,
      utilizedAt: entry.utilizedAt.toISOString().split('T')[0],
      remarks: entry.remarks,
      billId: entry.billId,
    };
  }

  private validateUtilization(data: { amount: number; utilizedAt: string }): void {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new BadRequestException('Utilization amount must be greater than zero.');
    }
    if (!data.utilizedAt || Number.isNaN(Date.parse(data.utilizedAt))) {
      throw new BadRequestException('Enter a valid utilization date.');
    }
  }

  private historyValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return value instanceof Date ? value.toISOString() : String(value);
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    if (left instanceof Date && right instanceof Date) {
      return left.getTime() === right.getTime();
    }
    return Object.is(left, right);
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
    if (data.scopeType !== undefined && data.scopeType !== null && !['program', 'district'].includes(data.scopeType)) {
      throw new BadRequestException('Transfer recipient type must be a program or district.');
    }
    if (data.districtFund !== undefined && data.districtFund !== null && !['incentive_funds', 'consultants_grant'].includes(data.districtFund)) {
      throw new BadRequestException('Choose Incentive Funds or Consultants Grant.');
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
