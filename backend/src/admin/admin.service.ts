import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillsService } from '../bills/bills.service';
import { TransfersService, type DistrictFund, type TransferInput } from '../transfers/transfers.service';
import { UserAuthService } from '../users/user-auth.service';

export type AdminEntity =
  | 'bills'
  | 'budgets'
  | 'budgetHeads'
  | 'objectHeads'
  | 'transfers'
  | 'districts'
  | 'users';

type JsonRecord = Record<string, unknown>;

const BACKUP_FORMAT = 'mahastride-database-backup';
const BACKUP_VERSION = 4;
const BACKUP_TABLES = [
  'bills',
  'billStageHistory',
  'budgets',
  'budgetHeads',
  'objectHeads',
  'transfers',
  'transferUtilizations',
  'transferHistory',
  'districts',
  'users',
] as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillsService,
    private readonly transfers: TransfersService,
    private readonly userAuth: UserAuthService,
  ) {}

  async importRows(entity: AdminEntity, rows: unknown): Promise<{
    imported: number;
    updated: number;
    failed: { row: number; error: string }[];
  }> {
    if (!['bills', 'budgets', 'budgetHeads', 'objectHeads', 'transfers', 'districts', 'users'].includes(entity)) {
      throw new BadRequestException('Spreadsheet import is not supported for this table.');
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('The spreadsheet must contain at least one data row.');
    }
    if (rows.length > 5000) {
      throw new BadRequestException('A spreadsheet import is limited to 5,000 rows.');
    }

    const billReferences = entity === 'bills' ? await this.loadBillReferences() : null;
    let imported = 0;
    let updated = 0;
    const failed: { row: number; error: string }[] = [];
    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        failed.push({ row: index + 2, error: 'Each data row must contain named columns.' });
        continue;
      }
      const sourceRow = (row as JsonRecord)._sourceRow;
      const rowNumber = typeof sourceRow === 'number' && Number.isInteger(sourceRow) && sourceRow > 1
        ? sourceRow
        : index + 2;
      try {
        if (billReferences) this.validateBillReferences(row as JsonRecord, billReferences);
        if (entity === 'budgets') {
          const result = await this.importBudgetRow(row as JsonRecord);
          if (result === 'updated') updated += 1;
          else imported += 1;
        } else {
          await this.create(entity, row as JsonRecord);
          imported += 1;
        }
      } catch (error) {
        failed.push({ row: rowNumber, error: this.importErrorMessage(error) });
      }
    }
    return { imported, updated, failed };
  }

  async createBackup() {
    const [bills, billStageHistory, budgets, budgetHeads, objectHeads, transfers, transferUtilizations, transferHistory, districts, users] =
      await Promise.all([
        this.prisma.bill.findMany(),
        this.prisma.billStageHistory.findMany(),
        this.prisma.budget.findMany(),
        this.prisma.budgetHead.findMany(),
        this.prisma.objectHead.findMany(),
        this.prisma.transfer.findMany(),
        this.prisma.transferUtilization.findMany(),
        this.prisma.transferHistory.findMany(),
        this.prisma.district.findMany(),
        this.prisma.user.findMany(),
      ]);

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      tables: { bills, billStageHistory, budgets, budgetHeads, objectHeads, transfers, transferUtilizations, transferHistory, districts, users },
    };
  }

  async restoreBackup(input: unknown): Promise<{ restored: Record<string, number> }> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('The backup file must contain a JSON object.');
    }
    const backup = input as JsonRecord;
    if (backup.format !== BACKUP_FORMAT || ![1, 2, 3, BACKUP_VERSION].includes(Number(backup.version))) {
      throw new BadRequestException('This is not a supported MahaSTRIDE database backup.');
    }
    if (!backup.tables || typeof backup.tables !== 'object' || Array.isArray(backup.tables)) {
      throw new BadRequestException('The backup is missing its tables.');
    }

    const tables = backup.tables as JsonRecord;
    const data = {
      budgetHeads: this.backupRows(tables, 'budgetHeads', ['code', 'name', 'description']),
      objectHeads: this.backupRows(tables, 'objectHeads', ['code', 'name', 'nameMr']),
      users: this.backupRows(tables, 'users', [
        'id', 'username', 'passwordHash', 'name', 'programs', 'districts', 'createdAt', 'updatedAt',
      ], ['createdAt', 'updatedAt']),
      budgets: this.backupRows(tables, 'budgets', [
        'id', 'code', 'fiscalYear', 'name', 'nameMr',
        'prov215', 'rel215', 'exp215', 'prov224', 'rel224', 'exp224', 'prov233', 'rel233', 'exp233',
      ]),
      transfers: this.backupRows(tables, 'transfers', [
        'id', 'recipient', 'scopeType', 'districtFund', 'purpose', 'objectCode', 'amount', 'fiscalYear', 'budgetCode',
        'orderDate', 'status', 'utilized', 'remarks', 'source', 'createdAt', 'updatedAt',
      ], ['orderDate', 'createdAt', 'updatedAt']),
      transferUtilizations: Array.isArray(tables.transferUtilizations)
        ? this.backupRows(tables, 'transferUtilizations', [
            'id', 'transferId', 'billId', 'amount', 'utilizedAt', 'remarks', 'createdAt',
          ], ['utilizedAt', 'createdAt'])
        : [],
      districts: this.backupRows(tables, 'districts', [
        'id', 'district', 'division', 'amount', 'releaseDate', 'remarks', 'source', 'createdAt', 'updatedAt',
      ], ['releaseDate', 'createdAt', 'updatedAt']),
      bills: this.backupRows(tables, 'bills', [
        'id', 'sr', 'vendor', 'invoice', 'efileNumber', 'date', 'amount', 'amountSanctioned', 'budgetCode', 'objectHead', 'transferId',
        'program', 'district', 'assignedUserId', 'bucket', 'cat', 'onHold', 'holdReason', 'status', 'attribute', 'note',
        'days', 'clearedFY', 'source', 'createdAt', 'updatedAt',
      ], ['date', 'createdAt', 'updatedAt']),
      billStageHistory: Number(backup.version) >= 4
        ? this.backupRows(tables, 'billStageHistory', [
            'id', 'billId', 'stage', 'enteredAt', 'source',
          ], ['enteredAt'])
        : [],
      transferHistory: this.backupRows(tables, 'transferHistory', [
        'id', 'transferId', 'changedAt', 'field', 'oldValue', 'newValue',
      ], ['changedAt']),
    };
    if (!data.billStageHistory.length && Number(backup.version) < 4) {
      data.billStageHistory = data.bills.map(bill => ({
        id: `legacy-stage-${bill.id}`,
        billId: bill.id,
        stage: String(bill.bucket || 'Invoice Raised'),
        enteredAt: bill.updatedAt instanceof Date
          ? bill.updatedAt
          : bill.createdAt instanceof Date
            ? bill.createdAt
            : new Date(),
        source: 'legacy_backup_snapshot',
      }));
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.billStageHistory.deleteMany();
      await tx.transferUtilization.deleteMany();
      await tx.transferHistory.deleteMany();
      await tx.bill.deleteMany();
      await tx.transfer.deleteMany();
      await tx.budget.deleteMany();
      await tx.district.deleteMany();
      await tx.budgetHead.deleteMany();
      await tx.objectHead.deleteMany();
      await tx.user.deleteMany();

      if (data.budgetHeads.length) await tx.budgetHead.createMany({ data: data.budgetHeads as Prisma.BudgetHeadCreateManyInput[] });
      if (data.objectHeads.length) await tx.objectHead.createMany({ data: data.objectHeads as Prisma.ObjectHeadCreateManyInput[] });
      if (data.users.length) await tx.user.createMany({ data: data.users as Prisma.UserCreateManyInput[] });
      if (data.budgets.length) await tx.budget.createMany({ data: data.budgets as Prisma.BudgetCreateManyInput[] });
      if (data.transfers.length) await tx.transfer.createMany({ data: data.transfers as Prisma.TransferCreateManyInput[] });
      if (data.districts.length) await tx.district.createMany({ data: data.districts as Prisma.DistrictCreateManyInput[] });
      if (data.bills.length) await tx.bill.createMany({ data: data.bills as Prisma.BillCreateManyInput[] });
      if (data.billStageHistory.length) {
        await tx.billStageHistory.createMany({ data: data.billStageHistory as Prisma.BillStageHistoryCreateManyInput[] });
      }
      const utilizationRows = data.transferUtilizations.length
        ? data.transferUtilizations
        : this.legacyUtilizationRows(data.transfers, data.bills);
      if (utilizationRows.length) {
        await tx.transferUtilization.createMany({ data: utilizationRows as Prisma.TransferUtilizationCreateManyInput[] });
      }
      for (const transfer of data.transfers) {
        const utilized = utilizationRows
          .filter(entry => entry.transferId === transfer.id)
          .reduce((sum, entry) => sum + Number(entry.amount), 0);
        await tx.transfer.update({ where: { id: transfer.id as string }, data: { utilized } });
      }
      if (data.transferHistory.length) {
        await tx.transferHistory.createMany({ data: data.transferHistory as Prisma.TransferHistoryCreateManyInput[] });
      }
    }, { maxWait: 10000, timeout: 60000 });

    return { restored: Object.fromEntries(BACKUP_TABLES.map(table => [table, data[table].length])) };
  }

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
        return (await this.prisma.user.findMany({
          orderBy: { name: 'asc' },
          select: {
            id: true,
            username: true,
            name: true,
            programs: true,
            districts: true,
            createdAt: true,
            updatedAt: true,
          },
        })).map(user => ({
          ...user,
          programs: this.stringList(JSON.parse(user.programs) as unknown),
          districts: this.stringList(JSON.parse(user.districts) as unknown),
        }));
    }
  }

  async create(entity: AdminEntity, input: JsonRecord): Promise<unknown> {
    switch (entity) {
      case 'bills': {
        const value = this.pick(input, [
          'sr', 'vendor', 'invoice', 'efileNumber', 'date', 'amount', 'amountSanctioned', 'budgetCode', 'objectHead',
          'transferId', 'program', 'district', 'assignedUserId', 'bucket', 'cat',
          'onHold', 'holdReason', 'status', 'attribute', 'note', 'days', 'clearedFY', 'source',
        ]);
        this.requireString(value, 'vendor');
        this.requireString(value, 'invoice');
        this.requireString(value, 'status');
        this.requireNumber(value, 'amount');
        if (value.onHold !== undefined && typeof value.onHold !== 'boolean') {
          throw new BadRequestException('onHold must be true or false.');
        }
        this.validateOptionalNumberFields(value, ['amountSanctioned']);
        this.validateOptionalStringFields(value, ['efileNumber', 'holdReason']);
        const bill = await this.bills.create({
          sr: this.optionalNumber(value.sr) ?? null,
          vendor: value.vendor as string,
          invoice: value.invoice as string,
          efileNumber: this.nullableString(value.efileNumber),
          date: this.date(value.date),
          amount: value.amount as number,
          amountSanctioned: this.optionalNumber(value.amountSanctioned) ?? null,
          bucket: this.optionalString(value.bucket) ?? 'Invoice Raised',
          cat: this.optionalString(value.cat) ?? 'in_progress',
          onHold: value.onHold === true,
          holdReason: this.nullableString(value.holdReason),
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
          'prov215', 'rel215', 'exp215', 'prov224', 'rel224', 'exp224', 'prov233', 'rel233', 'exp233',
        ]);
        const code = this.requireString(value, 'code');
        const fiscalYear = this.optionalString(value.fiscalYear)?.trim() || 'FY 2026-27';
        return this.prisma.budget.create({
          data: {
            id: this.optionalString(value.id) ?? `${fiscalYear}:${code}`,
            code,
            fiscalYear,
            name: this.requireString(value, 'name'),
            nameMr: this.optionalString(value.nameMr) ?? '',
            prov215: this.optionalNumber(value.prov215) ?? 0,
            rel215: this.optionalNumber(value.rel215) ?? 0,
            exp215: this.optionalNumber(value.exp215) ?? 0,
            prov224: this.optionalNumber(value.prov224) ?? 0,
            rel224: this.optionalNumber(value.rel224) ?? 0,
            exp224: this.optionalNumber(value.exp224) ?? 0,
            prov233: this.optionalNumber(value.prov233) ?? 0,
            rel233: this.optionalNumber(value.rel233) ?? 0,
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
        const value = this.pick(input, ['username', 'password', 'name', 'programs', 'districts']);
        const username = this.requireUsername(value);
        await this.ensureUsernameAvailable(username);
        const passwordHash = await this.userAuth.hashPassword(this.requireString(value, 'password'));
        return this.prisma.user.create({
          data: {
            username,
            passwordHash,
            name: this.requireString(value, 'name'),
            programs: JSON.stringify(this.stringList(value.programs)),
            districts: JSON.stringify(this.stringList(value.districts)),
          },
          select: {
            id: true, username: true, name: true, programs: true, districts: true, createdAt: true, updatedAt: true,
          },
        });
      }
    }
  }

  async update(entity: AdminEntity, id: string, input: JsonRecord): Promise<unknown> {
    switch (entity) {
      case 'bills': {
        const value = this.pick(input, [
          'sr', 'vendor', 'invoice', 'efileNumber', 'date', 'amount', 'amountSanctioned', 'budgetCode', 'objectHead',
          'transferId', 'program', 'district', 'assignedUserId', 'bucket', 'cat',
          'onHold', 'holdReason', 'status', 'attribute', 'note', 'days', 'clearedFY', 'source',
        ]);
        this.validateOptionalStringFields(value, [
          'vendor', 'invoice', 'efileNumber', 'budgetCode', 'objectHead', 'transferId', 'program', 'district',
          'assignedUserId', 'bucket', 'cat', 'holdReason', 'status', 'attribute', 'note', 'clearedFY', 'source',
        ]);
        this.validateOptionalNumberFields(value, ['sr', 'amount', 'amountSanctioned', 'days']);
        if (value.onHold !== undefined && typeof value.onHold !== 'boolean') {
          throw new BadRequestException('onHold must be true or false.');
        }
        return this.bills.update(id, {
          ...value,
          ...(this.hasOwn(value, 'date') ? { date: this.date(value.date) } : {}),
        } as Parameters<BillsService['update']>[1]);
      }
      case 'budgets': {
        const value = this.pick(input, [
          'name', 'nameMr',
          'prov215', 'rel215', 'exp215', 'prov224', 'rel224', 'exp224', 'prov233', 'rel233', 'exp233',
        ]);
        this.validateOptionalStringFields(value, ['name', 'nameMr']);
        this.validateOptionalNumberFields(value, [
          'prov215', 'rel215', 'exp215', 'prov224', 'rel224', 'exp224', 'prov233', 'rel233', 'exp233',
        ]);
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
        const value = this.pick(input, ['username', 'password', 'name', 'programs', 'districts']);
        this.validateOptionalStringFields(value, ['username', 'password', 'name']);
        if (this.hasOwn(value, 'name') && value.name === null) {
          throw new BadRequestException('name must be a non-empty string.');
        }
        const username = this.hasOwn(value, 'username') ? this.requireUsername(value) : undefined;
        if (username !== undefined) await this.ensureUsernameAvailable(username, id);
        const passwordHash = this.hasOwn(value, 'password')
          ? await this.userAuth.hashPassword(this.requireString(value, 'password'))
          : undefined;
        return this.prisma.user.update({
          where: { id },
          data: {
            ...(username !== undefined && { username }),
            ...(passwordHash !== undefined && { passwordHash }),
            ...(this.hasOwn(value, 'name') && { name: this.requireString(value, 'name') }),
            ...(this.hasOwn(value, 'programs') && { programs: JSON.stringify(this.stringList(value.programs)) }),
            ...(this.hasOwn(value, 'districts') && { districts: JSON.stringify(this.stringList(value.districts)) }),
          },
          select: {
            id: true, username: true, name: true, programs: true, districts: true, createdAt: true, updatedAt: true,
          },
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
    }
  }

  private async importBudgetRow(input: JsonRecord): Promise<'imported' | 'updated'> {
    const value = this.pick(input, [
      'id', 'code', 'fiscalYear', 'name', 'nameMr',
      'prov215', 'rel215', 'exp215', 'prov224', 'rel224', 'exp224', 'prov233', 'rel233', 'exp233',
    ]);
    const code = this.requireString(value, 'code');
    const fiscalYear = this.optionalString(value.fiscalYear) ?? 'FY 2026-27';
    const where = { fiscalYear_code: { fiscalYear, code } };
    const numericFields = [
      'prov215', 'rel215', 'exp215', 'prov224', 'rel224', 'exp224', 'prov233', 'rel233', 'exp233',
    ] as const;
    this.validateOptionalStringFields(value, ['name', 'nameMr']);
    this.validateOptionalNumberFields(value, [...numericFields]);

    const update: Prisma.BudgetUpdateInput = {};
    const name = this.optionalString(value.name);
    const nameMr = this.optionalString(value.nameMr);
    if (name) update.name = name;
    if (nameMr) update.nameMr = nameMr;
    for (const field of numericFields) {
      const number = this.optionalNumber(value[field]);
      if (number !== undefined) update[field] = number;
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.budget.findUnique({ where });
      await tx.budget.upsert({
        where,
        create: {
          id: (existing?.id ?? this.optionalString(value.id)) || `${fiscalYear}:${code}`,
          code,
          fiscalYear,
          name: name?.trim() ? name : existing?.name ?? this.requireString(value, 'name'),
          nameMr: nameMr?.trim() ? nameMr : existing?.nameMr ?? '',
          prov215: this.optionalNumber(value.prov215) ?? existing?.prov215 ?? 0,
          rel215: this.optionalNumber(value.rel215) ?? existing?.rel215 ?? 0,
          exp215: this.optionalNumber(value.exp215) ?? existing?.exp215 ?? 0,
          prov224: this.optionalNumber(value.prov224) ?? existing?.prov224 ?? 0,
          rel224: this.optionalNumber(value.rel224) ?? existing?.rel224 ?? 0,
          exp224: this.optionalNumber(value.exp224) ?? existing?.exp224 ?? 0,
          prov233: this.optionalNumber(value.prov233) ?? existing?.prov233 ?? 0,
          rel233: this.optionalNumber(value.rel233) ?? existing?.rel233 ?? 0,
          exp233: this.optionalNumber(value.exp233) ?? existing?.exp233 ?? 0,
        },
        update,
      });
      return existing ? 'updated' : 'imported';
    });
  }

  private transferInput(input: JsonRecord): TransferInput;
  private transferInput(input: JsonRecord, partial: true): Partial<TransferInput>;
  private transferInput(input: JsonRecord, partial = false): TransferInput | Partial<TransferInput> {
    const value = this.pick(input, [
      'recipient', 'scopeType', 'districtFund', 'purpose', 'objectCode', 'amount', 'fiscalYear',
      'budgetCode', 'orderDate', 'status', 'utilized', 'utilizationDate', 'remarks',
    ]);
    this.validateOptionalStringFields(value, [
      'recipient', 'scopeType', 'districtFund', 'purpose', 'objectCode', 'fiscalYear', 'budgetCode', 'status', 'remarks',
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
        districtFund: this.transferDistrictFund(value.districtFund),
        purpose: this.requireString(value, 'purpose'),
        objectCode: this.optionalString(value.objectCode) ?? '01',
        amount: this.requireNumber(value, 'amount'),
        fiscalYear: this.optionalString(value.fiscalYear) ?? 'FY 2026-27',
        budgetCode: this.nullableString(value.budgetCode),
        orderDate: this.date(value.orderDate)?.toISOString().slice(0, 10) ?? null,
        status: status ?? 'minutes_awaited',
        utilized: this.optionalNumber(value.utilized) ?? 0,
        utilizationDate: this.date(value.utilizationDate)?.toISOString().slice(0, 10) ?? null,
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
    if (this.hasOwn(value, 'districtFund')) {
      result.districtFund = this.transferDistrictFund(value.districtFund);
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
    if (this.hasOwn(value, 'utilizationDate')) result.utilizationDate = this.date(value.utilizationDate)?.toISOString().slice(0, 10) ?? null;
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

  private transferDistrictFund(value: unknown): DistrictFund | null {
    const category = this.optionalString(value)?.toLowerCase().replace(/[\s-]+/g, '_');
    if (!category) return null;
    if (category === 'incentive_funds' || category === 'consultants_grant') return category;
    throw new BadRequestException('districtFund must be incentive_funds or consultants_grant.');
  }

  private legacyUtilizationRows(transfers: JsonRecord[], bills: JsonRecord[]): JsonRecord[] {
    const rows: JsonRecord[] = [];
    const linkedAmounts = new Map<string, number>();
    for (const bill of bills) {
      if (bill.cat !== 'cleared' || typeof bill.transferId !== 'string') continue;
      const amount = bill.bucket === 'Cleared by Treasury' && typeof bill.amountSanctioned === 'number'
        ? bill.amountSanctioned
        : Number(bill.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const transferId = bill.transferId;
      linkedAmounts.set(transferId, (linkedAmounts.get(transferId) || 0) + amount);
      rows.push({
        id: `restored-bill-util-${String(bill.id)}`,
        transferId,
        billId: bill.id,
        amount,
        utilizedAt: bill.updatedAt instanceof Date ? bill.updatedAt : new Date(),
        remarks: `Linked cleared bill: ${String(bill.vendor || '')} / ${String(bill.invoice || '')}`,
      });
    }
    for (const transfer of transfers) {
      const transferId = String(transfer.id);
      const legacyAmount = Number(transfer.utilized || 0) - (linkedAmounts.get(transferId) || 0);
      if (legacyAmount <= 0) continue;
      rows.push({
        id: `restored-legacy-util-${transferId}`,
        transferId,
        amount: legacyAmount,
        utilizedAt: transfer.updatedAt instanceof Date ? transfer.updatedAt : new Date(),
        remarks: 'Restored aggregate utilization; original entry date unavailable',
      });
    }
    return rows;
  }

  private backupRows(
    tables: JsonRecord,
    table: string,
    fields: string[],
    dateFields: string[] = [],
  ): JsonRecord[] {
    const rows = tables[table];
    if (!Array.isArray(rows)) {
      throw new BadRequestException(`The backup is missing the ${table} table.`);
    }
    return rows.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new BadRequestException(`Invalid ${table} record at backup row ${index + 1}.`);
      }
      const value = this.pick(row as JsonRecord, fields);
      for (const field of dateFields) {
        const date = value[field];
        if (date === undefined || date === null) continue;
        if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
          throw new BadRequestException(`Invalid ${field} date in ${table} backup row ${index + 1}.`);
        }
        value[field] = new Date(date);
      }
      return value;
    });
  }

  private exceptionMessage(error: HttpException): string {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
    return error.message;
  }

  private importErrorMessage(error: unknown): string {
    if (error instanceof HttpException) return this.exceptionMessage(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const field = error.meta?.field_name;
      switch (error.code) {
        case 'P2002':
          return 'A record with the same unique value already exists.';
        case 'P2003':
          return `A referenced record does not exist${typeof field === 'string' ? ` (${field})` : ''}. Check the linked code or ID.`;
        case 'P2025':
          return 'A required related record could not be found.';
        case 'P2000':
          return 'A value is too long for its database column.';
        default:
          return `Database rejected this row (${error.code}). Check the row values and related records.`;
      }
    }
    if (error instanceof Error) {
      const firstLine = error.message.split(/\r?\n/, 1)[0].trim();
      if (firstLine && !firstLine.startsWith('Invalid `')) return firstLine;
    }
    return 'Could not save this row due to a database error.';
  }

  private async loadBillReferences(): Promise<Record<string, Set<string>>> {
    const [budgetHeads, objectHeads, transfers, users] = await Promise.all([
      this.prisma.budgetHead.findMany({ select: { code: true } }),
      this.prisma.objectHead.findMany({ select: { code: true } }),
      this.prisma.transfer.findMany({ select: { id: true } }),
      this.prisma.user.findMany({ select: { id: true } }),
    ]);
    return {
      budgetCode: new Set(budgetHeads.map(item => item.code)),
      objectHead: new Set(objectHeads.map(item => item.code)),
      transferId: new Set(transfers.map(item => item.id)),
      assignedUserId: new Set(users.map(item => item.id)),
    };
  }

  private validateBillReferences(
    row: JsonRecord,
    references: Record<string, Set<string>>,
  ): void {
    const referenceLabels: Record<string, string> = {
      budgetCode: 'budget head',
      objectHead: 'object head',
      transferId: 'transfer',
      assignedUserId: 'assigned user',
    };
    for (const [field, label] of Object.entries(referenceLabels)) {
      const value = row[field];
      if (value === undefined || value === null || value === '') continue;
      if (typeof value !== 'string') {
        throw new BadRequestException(`${field} must be a text code or ID, or left blank.`);
      }
      const reference = value.trim();
      if (!reference) continue;
      if (!references[field].has(reference)) {
        throw new BadRequestException(
          `${field} "${reference}" does not match an existing ${label}. Import that ${label} first or leave the column blank.`,
        );
      }
    }
  }

  private requireString(value: JsonRecord, field: string): string {
    const item = value[field];
    if (typeof item !== 'string' || !item.trim()) {
      throw new BadRequestException(`${field} must be a non-empty string.`);
    }
    return item.trim();
  }

  private requireUsername(value: JsonRecord): string {
    const username = this.requireString(value, 'username').toLowerCase();
    if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
      throw new BadRequestException('username must be 3–64 characters using letters, numbers, dots, underscores or hyphens.');
    }
    return username;
  }

  private async ensureUsernameAvailable(username: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing && existing.id !== exceptId) {
      throw new BadRequestException('That username is already assigned to another user.');
    }
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
