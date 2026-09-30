import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillsService } from '../bills/bills.service';
import { TransfersService, type TransferInput } from '../transfers/transfers.service';

export type AdminEntity =
  | 'bills'
  | 'budgets'
  | 'budgetHeads'
  | 'objectHeads'
  | 'transfers'
  | 'districts'
  | 'users'
  | 'devices';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillsService,
    private readonly transfers: TransfersService,
  ) {}

  async list(entity: AdminEntity): Promise<unknown[]> {
    switch (entity) {
      case 'bills':
        return this.prisma.bill.findMany({ orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }] });
      case 'budgets':
        return this.prisma.budget.findMany({ orderBy: [{ fiscalYear: 'desc' }, { code: 'asc' }] });
      case 'budgetHeads':
        return this.prisma.budgetHead.findMany({ orderBy: { code: 'asc' } });
      case 'objectHeads':
        return this.prisma.objectHead.findMany({ orderBy: { code: 'asc' } });
      case 'transfers':
        return this.transfers.findAll();
      case 'districts':
        return this.prisma.district.findMany({ orderBy: [{ division: 'asc' }, { district: 'asc' }] });
      case 'users':
        return this.prisma.user.findMany({ orderBy: { name: 'asc' } });
      case 'devices':
        return this.prisma.userDevice.findMany({
          orderBy: { lastSeenAt: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        });
    }
  }

  async create(entity: AdminEntity, input: JsonRecord): Promise<unknown> {
    switch (entity) {
      case 'bills': {
        const value = this.pick(input, [
          'sr', 'vendor', 'invoice', 'date', 'amount', 'budgetCode', 'objectHead',
          'transferId', 'program', 'district', 'assignedUserId', 'bucket', 'cat',
          'status', 'attribute', 'note', 'days', 'source',
        ]);
        this.requireString(value, 'vendor');
        this.requireString(value, 'invoice');
        this.requireString(value, 'status');
        this.requireNumber(value, 'amount');
        const bill = await this.bills.create({
          sr: this.optionalNumber(value.sr) ?? null,
          vendor: value.vendor as string,
          invoice: value.invoice as string,
          date: this.date(value.date),
          amount: value.amount as number,
          bucket: this.optionalString(value.bucket) ?? 'Invoice Raised',
          cat: this.optionalString(value.cat) ?? 'in_progress',
          status: value.status as string,
          attribute: this.nullableString(value.attribute),
          note: this.nullableString(value.note),
          days: this.optionalNumber(value.days) ?? null,
          clearedFY: this.nullableString(value.clearedFY),
          source: this.optionalString(value.source) ?? 'admin',
          budgetCode: this.nullableString(value.budgetCode),
          objectHead: this.nullableString(value.objectHead),
          transferId: this.nullableString(value.transferId),
          program: this.nullableString(value.program),
          district: this.nullableString(value.district),
          assignedUserId: this.nullableString(value.assignedUserId),
        });
        return bill;
      }
      case 'budgets': {
        const value = this.pick(input, [
          'id', 'code', 'fiscalYear', 'name', 'nameMr',
          'prov215', 'exp215', 'prov224', 'exp224', 'prov233', 'exp233',
        ]);
        const code = this.requireString(value, 'code');
        const fiscalYear = this.optionalString(value.fiscalYear) ?? 'FY 2026-27';
        return this.prisma.budget.create({
          data: {
            id: this.optionalString(value.id) ?? `${fiscalYear}:${code}`,
            code,
            fiscalYear,
            name: this.requireString(value, 'name'),
            nameMr: this.optionalString(value.nameMr) ?? '',
            prov215: this.optionalNumber(value.prov215) ?? 0,
            exp215: this.optionalNumber(value.exp215) ?? 0,
            prov224: this.optionalNumber(value.prov224) ?? 0,
            exp224: this.optionalNumber(value.exp224) ?? 0,
            prov233: this.optionalNumber(value.prov233) ?? 0,
            exp233: this.optionalNumber(value.exp233) ?? 0,
          },
        });
      }
      case 'budgetHeads': {
        const value = this.pick(input, ['code', 'name', 'description']);
        return this.prisma.budgetHead.create({
          data: {
            code: this.requireString(value, 'code'),
            name: this.requireString(value, 'name'),
            description: this.requireString(value, 'description'),
          },
        });
      }
      case 'objectHeads': {
        const value = this.pick(input, ['code', 'name', 'nameMr']);
        return this.prisma.objectHead.create({
          data: {
            code: this.requireString(value, 'code'),
            name: this.requireString(value, 'name'),
            nameMr: this.optionalString(value.nameMr) ?? '',
          },
        });
      }
      case 'transfers': {
        const data = this.transferInput(input);
        return this.transfers.create(data);
      }
      case 'districts': {
        const value = this.pick(input, ['district', 'division', 'amount', 'releaseDate', 'remarks', 'source']);
        return this.prisma.district.create({
          data: {
            district: this.requireString(value, 'district'),
            division: this.requireString(value, 'division'),
            amount: this.optionalNumber(value.amount) ?? 0,
            releaseDate: this.date(value.releaseDate),
            remarks: this.nullableString(value.remarks),
            source: this.optionalString(value.source) ?? 'admin',
          },
        });
      }
      case 'users': {
        const value = this.pick(input, ['name', 'programs', 'districts']);
        return this.prisma.user.create({
          data: {
            name: this.requireString(value, 'name'),
            programs: JSON.stringify(this.stringList(value.programs)),
            districts: JSON.stringify(this.stringList(value.districts)),
          },
        });
      }
      case 'devices': {
        const value = this.pick(input, ['deviceId', 'ipAddress', 'userAgent', 'userId', 'accessEnabled']);
        const userId = this.nullableString(value.userId);
        if (value.accessEnabled !== undefined && typeof value.accessEnabled !== 'boolean') {
          throw new BadRequestException('accessEnabled must be true or false.');
        }
        if (value.accessEnabled === true && !userId) {
          throw new BadRequestException('Assign a user before enabling device access.');
        }
        if (userId) await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        return this.prisma.userDevice.create({
          data: {
            deviceId: this.requireString(value, 'deviceId'),
            ipAddress: this.nullableString(value.ipAddress),
            userAgent: this.requireString(value, 'userAgent'),
            userId,
            accessEnabled: Boolean(userId) && value.accessEnabled === true,
          },
        });
      }
    }
  }

  async update(entity: AdminEntity, id: string, input: JsonRecord): Promise<unknown> {
    switch (entity) {
      case 'bills': {
        const value = this.pick(input, [
          'sr', 'vendor', 'invoice', 'date', 'amount', 'budgetCode', 'objectHead',
          'transferId', 'program', 'district', 'assignedUserId', 'bucket', 'cat',
          'status', 'attribute', 'note', 'days', 'clearedFY', 'source',
        ]);
        this.validateOptionalStringFields(value, [
          'vendor', 'invoice', 'budgetCode', 'objectHead', 'transferId', 'program', 'district',
          'assignedUserId', 'bucket', 'cat', 'status', 'attribute', 'note', 'clearedFY', 'source',
        ]);
        this.validateOptionalNumberFields(value, ['sr', 'amount', 'days']);
        return this.bills.update(id, {
          ...value,
          ...(this.hasOwn(value, 'date') ? { date: this.date(value.date) } : {}),
        } as Parameters<BillsService['update']>[1]);
      }
      case 'budgets': {
        const value = this.pick(input, [
          'name', 'nameMr', 'prov215', 'exp215', 'prov224', 'exp224', 'prov233', 'exp233',
        ]);
        this.validateOptionalStringFields(value, ['name', 'nameMr']);
        this.validateOptionalNumberFields(value, ['prov215', 'exp215', 'prov224', 'exp224', 'prov233', 'exp233']);
        return this.prisma.budget.update({
          where: { id },
          data: value as Prisma.BudgetUpdateInput,
        });
      }
      case 'budgetHeads': {
        const value = this.pick(input, ['name', 'description']);
        this.validateOptionalStringFields(value, ['name', 'description']);
        return this.prisma.budgetHead.update({
          where: { code: id },
          data: value as Prisma.BudgetHeadUpdateInput,
        });
      }
      case 'objectHeads': {
        const value = this.pick(input, ['name', 'nameMr']);
        this.validateOptionalStringFields(value, ['name', 'nameMr']);
        return this.prisma.objectHead.update({
          where: { code: id },
          data: value as Prisma.ObjectHeadUpdateInput,
        });
      }
      case 'transfers':
        return this.transfers.update(id, this.transferInput(input, true));
      case 'districts': {
        const value = this.pick(input, ['district', 'division', 'amount', 'releaseDate', 'remarks', 'source']);
        this.validateOptionalStringFields(value, ['district', 'division', 'remarks', 'source']);
        this.validateOptionalNumberFields(value, ['amount']);
        return this.prisma.district.update({
          where: { id },
          data: {
            ...value,
            ...(this.hasOwn(value, 'releaseDate') ? { releaseDate: this.date(value.releaseDate) } : {}),
          },
        });
      }
      case 'users': {
        const value = this.pick(input, ['name', 'programs', 'districts']);
        this.validateOptionalStringFields(value, ['name']);
        if (this.hasOwn(value, 'name') && value.name === null) {
          throw new BadRequestException('name must be a non-empty string.');
        }
        return this.prisma.user.update({
          where: { id },
          data: {
            ...(this.hasOwn(value, 'name') && { name: this.requireString(value, 'name') }),
            ...(this.hasOwn(value, 'programs') && { programs: JSON.stringify(this.stringList(value.programs)) }),
            ...(this.hasOwn(value, 'districts') && { districts: JSON.stringify(this.stringList(value.districts)) }),
          },
        });
      }
      case 'devices': {
        const value = this.pick(input, ['ipAddress', 'userAgent', 'userId', 'accessEnabled']);
        this.validateOptionalStringFields(value, ['userAgent']);
        if (this.hasOwn(value, 'accessEnabled') && typeof value.accessEnabled !== 'boolean') {
          throw new BadRequestException('accessEnabled must be true or false.');
        }
        const userId = this.nullableString(value.userId);
        if (userId) await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const current = await this.prisma.userDevice.findUniqueOrThrow({
          where: { id },
          select: { userId: true, accessEnabled: true },
        });
        const nextUserId = this.hasOwn(value, 'userId') ? userId : current.userId;
        if (value.accessEnabled === true && !nextUserId) {
          throw new BadRequestException('Assign a user before enabling device access.');
        }
        const requestedAccess = this.hasOwn(value, 'accessEnabled')
          ? value.accessEnabled === true
          : current.accessEnabled;
        return this.prisma.userDevice.update({
          where: { id },
          data: {
            ...(this.hasOwn(value, 'ipAddress') && { ipAddress: this.nullableString(value.ipAddress) }),
            ...(this.hasOwn(value, 'userAgent') && { userAgent: this.requireString(value, 'userAgent') }),
            ...(this.hasOwn(value, 'userId') && { userId }),
            accessEnabled: Boolean(nextUserId) && requestedAccess,
          },
          include: { user: { select: { id: true, name: true } } },
        });
      }
    }
  }

  async remove(entity: AdminEntity, id: string): Promise<unknown> {
    switch (entity) {
      case 'bills':
        return this.bills.remove(id);
      case 'budgets':
        return this.prisma.budget.delete({ where: { id } });
      case 'budgetHeads':
        return this.prisma.budgetHead.delete({ where: { code: id } });
      case 'objectHeads':
        return this.prisma.objectHead.delete({ where: { code: id } });
      case 'transfers':
        return this.transfers.remove(id);
      case 'districts':
        return this.prisma.district.delete({ where: { id } });
      case 'users':
        return this.prisma.user.delete({ where: { id } });
      case 'devices':
        return this.prisma.userDevice.delete({ where: { id } });
    }
  }

  private transferInput(input: JsonRecord): TransferInput;
  private transferInput(input: JsonRecord, partial: true): Partial<TransferInput>;
  private transferInput(input: JsonRecord, partial = false): TransferInput | Partial<TransferInput> {
    const value = this.pick(input, [
      'recipient', 'scopeType', 'purpose', 'objectCode', 'amount', 'fiscalYear',
      'budgetCode', 'orderDate', 'status', 'utilized', 'remarks',
    ]);
    this.validateOptionalStringFields(value, [
      'recipient', 'scopeType', 'purpose', 'objectCode', 'fiscalYear', 'budgetCode', 'status', 'remarks',
    ]);
    this.validateOptionalNumberFields(value, ['amount', 'utilized']);
    if (!partial) {
      const scopeType = this.optionalString(value.scopeType);
      const status = this.optionalString(value.status);
      if (scopeType !== undefined && scopeType !== 'program' && scopeType !== 'district') {
        throw new BadRequestException('scopeType must be program or district.');
      }
      if (status !== undefined && status !== 'transferred' && status !== 'minutes_awaited') {
        throw new BadRequestException('status must be transferred or minutes_awaited.');
      }
      return {
        recipient: this.requireString(value, 'recipient'),
        scopeType: scopeType ?? null,
        purpose: this.requireString(value, 'purpose'),
        objectCode: this.optionalString(value.objectCode) ?? '01',
        amount: this.requireNumber(value, 'amount'),
        fiscalYear: this.optionalString(value.fiscalYear) ?? 'FY 2026-27',
        budgetCode: this.nullableString(value.budgetCode),
        orderDate: this.date(value.orderDate)?.toISOString().slice(0, 10) ?? null,
        status: status ?? 'minutes_awaited',
        utilized: this.optionalNumber(value.utilized) ?? 0,
        remarks: this.nullableString(value.remarks),
      };
    }

    const result: Partial<TransferInput> = {};
    if (this.hasOwn(value, 'recipient')) result.recipient = this.requireString(value, 'recipient');
    if (this.hasOwn(value, 'scopeType')) {
      const scopeType = this.optionalString(value.scopeType);
      if (scopeType !== undefined && scopeType !== 'program' && scopeType !== 'district') {
        throw new BadRequestException('scopeType must be program or district.');
      }
      result.scopeType = scopeType ?? null;
    }
    if (this.hasOwn(value, 'purpose')) result.purpose = this.requireString(value, 'purpose');
    if (this.hasOwn(value, 'objectCode')) result.objectCode = this.requireString(value, 'objectCode');
    if (this.hasOwn(value, 'amount')) result.amount = this.requireNumber(value, 'amount');
    if (this.hasOwn(value, 'fiscalYear')) result.fiscalYear = this.requireString(value, 'fiscalYear');
    if (this.hasOwn(value, 'budgetCode')) result.budgetCode = this.nullableString(value.budgetCode);
    if (this.hasOwn(value, 'orderDate')) result.orderDate = this.date(value.orderDate)?.toISOString().slice(0, 10) ?? null;
    if (this.hasOwn(value, 'status')) {
      const status = this.requireString(value, 'status');
      if (status !== 'transferred' && status !== 'minutes_awaited') {
        throw new BadRequestException('status must be transferred or minutes_awaited.');
      }
      result.status = status;
    }
    if (this.hasOwn(value, 'utilized')) result.utilized = this.requireNumber(value, 'utilized');
    if (this.hasOwn(value, 'remarks')) result.remarks = this.nullableString(value.remarks);
    return result;
  }

  private pick(input: JsonRecord, fields: string[]): JsonRecord {
    const value: JsonRecord = {};
    for (const field of fields) {
      if (this.hasOwn(input, field)) value[field] = input[field];
    }
    return value;
  }

  private requireString(value: JsonRecord, field: string): string {
    const item = value[field];
    if (typeof item !== 'string' || !item.trim()) {
      throw new BadRequestException(`${field} must be a non-empty string.`);
    }
    return item.trim();
  }

  private optionalString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') throw new BadRequestException('Expected a string value.');
    return value;
  }

  private nullableString(value: unknown): string | null {
    return value === undefined || value === null || value === '' ? null : this.optionalString(value) ?? null;
  }

  private requireNumber(value: JsonRecord, field: string): number {
    const item = value[field];
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new BadRequestException(`${field} must be a finite number.`);
    }
    return item;
  }

  private optionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException('Expected a finite number.');
    }
    return value;
  }

  private date(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      throw new BadRequestException('Date must be a valid ISO date string or null.');
    }
    return new Date(value);
  }

  private stringList(value: unknown): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
      throw new BadRequestException('Programs and districts must be arrays of strings.');
    }
    return [...new Set(value.map(item => item.trim()).filter(Boolean))];
  }

  private validateOptionalStringFields(value: JsonRecord, fields: string[]): void {
    for (const field of fields) {
      if (this.hasOwn(value, field) && value[field] !== null && typeof value[field] !== 'string') {
        throw new BadRequestException(`${field} must be a string or null.`);
      }
    }
  }

  private validateOptionalNumberFields(value: JsonRecord, fields: string[]): void {
    for (const field of fields) {
      if (this.hasOwn(value, field)) this.optionalNumber(value[field]);
    }
  }

  private hasOwn(value: object, field: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, field);
  }
}
