import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FISCAL_YEARS } from '../src/common/bill-utils';

declare const process: {
  argv: string[];
  cwd(): string;
  env: Record<string, string | undefined>;
  exitCode?: number;
};

const prisma = new PrismaClient();
const HEADERS = [
  'fiscalYear',
  'objectCode',
  'prov215',
  'prov224',
  'prov233',
];
const FIELDS = ['prov215', 'prov224', 'prov233'] as const;

interface BudgetImportRow {
  fiscalYear: string;
  objectCode: string;
  values: Record<(typeof FIELDS)[number], number>;
}

function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(value.trim());
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      value = '';
      if (row.some((cell) => cell.length > 0)) records.push(row);
      row = [];
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    if (row.some((cell) => cell.length > 0)) records.push(row);
  }
  return records;
}

function readRows(csv: string): BudgetImportRow[] {
  const records = parseCsv(csv.replace(/^\uFEFF/, ''));
  const headers = records.shift();
  if (!headers || headers.join(',') !== HEADERS.join(',')) {
    throw new Error(`CSV header must be exactly: ${HEADERS.join(',')}`);
  }

  const seen = new Set<string>();
  return records.map((cells, index) => {
    const line = index + 2;
    if (cells.length !== HEADERS.length) {
      throw new Error(`Line ${line} must contain ${HEADERS.length} comma-separated values.`);
    }

    const [fiscalYear, objectCode, ...amounts] = cells;
    if (!FISCAL_YEARS.includes(fiscalYear)) {
      throw new Error(`Line ${line} has unsupported fiscal year "${fiscalYear}".`);
    }
    if (!/^\d{2}$/.test(objectCode)) {
      throw new Error(`Line ${line} has invalid object code "${objectCode}".`);
    }
    const key = `${fiscalYear}:${objectCode}`;
    if (seen.has(key)) throw new Error(`Line ${line} duplicates ${key}.`);
    seen.add(key);

    const values = {} as Record<(typeof FIELDS)[number], number>;
    FIELDS.forEach((field, amountIndex) => {
      const amount = Number(amounts[amountIndex]);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Line ${line} has invalid ${field} value "${amounts[amountIndex]}".`);
      }
      values[field] = amount;
    });

    return { fiscalYear, objectCode, values };
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Budget imports are disabled in production. Use the authenticated admin panel instead.');
  }
  if (process.env.ALLOW_BUDGET_IMPORT !== 'true') {
    throw new Error('Set ALLOW_BUDGET_IMPORT=true to explicitly enable a development budget import.');
  }
  const fileName = process.argv[2];
  if (!fileName) {
    throw new Error('Usage: npm run db:budget:import -- <csv-file>');
  }

  const rows = readRows(await readFile(resolve(process.env.INIT_CWD || process.cwd(), fileName), 'utf8'));
  if (rows.length === 0) throw new Error('CSV does not contain any budget rows.');

  const objectHeads = await prisma.objectHead.findMany();
  const objectHeadsByCode = new Map(objectHeads.map((head) => [head.code, head]));
  for (const row of rows) {
    if (!objectHeadsByCode.has(row.objectCode)) {
      throw new Error(`Object head ${row.objectCode} does not exist. Provision it in the development database first.`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const objectHead = objectHeadsByCode.get(row.objectCode)!;
      await tx.budget.upsert({
        where: {
          fiscalYear_code: { fiscalYear: row.fiscalYear, code: row.objectCode },
        },
        update: row.values,
        create: {
          id: `${row.fiscalYear}:${row.objectCode}`,
          fiscalYear: row.fiscalYear,
          code: row.objectCode,
          name: objectHead.name,
          nameMr: objectHead.nameMr,
          ...row.values,
        },
      });
    }
  });

  console.log(`Imported ${rows.length} budget rows across ${new Set(rows.map((row) => row.fiscalYear)).size} fiscal year(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
