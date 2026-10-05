import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { clearedFYOf, FISCAL_YEARS, pct } from '../common/bill-utils';

export const TOTAL_FISCAL_YEAR = 'FY Total';

export interface BudgetRow {
  id: string;
  fiscalYear: string;
  code: string;
  name: string;
  nameMr: string;
  prov215: number;
  rel215: number;
  exp215: number;
  prov224: number;
  rel224: number;
  exp224: number;
  prov233: number;
  rel233: number;
  exp233: number;
  objectHead: {
    code: string;
    name: string;
    nameMr: string;
  };
}

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  async findAll(fiscalYear: string): Promise<BudgetRow[]> {
    const rows = await this.prisma.budget.findMany({
      where: { fiscalYear },
      orderBy: { code: 'asc' },
      include: { objectHead: true },
    });
    return rows.map(r => ({
      id: r.id,
      fiscalYear: r.fiscalYear,
      code: r.code,
      name: r.name,
      nameMr: r.nameMr,
      prov215: r.prov215,
      rel215: r.rel215,
      exp215: r.exp215,
      prov224: r.prov224,
      rel224: r.rel224,
      exp224: r.exp224,
      prov233: r.prov233,
      rel233: r.rel233,
      exp233: r.exp233,
      objectHead: r.objectHead,
    }));
  }

  async update(
    fiscalYear: string,
    code: string,
    data: Partial<Pick<
      BudgetRow,
      'prov215' | 'rel215' | 'exp215' | 'prov224' | 'rel224' | 'exp224' | 'prov233' | 'rel233' | 'exp233'
    >>,
  ) {
    return this.prisma.budget.update({
      where: { fiscalYear_code: { fiscalYear, code } },
      data,
    });
  }

  async getTotals(fiscalYear: string = 'FY 2026-27') {
    if (fiscalYear !== TOTAL_FISCAL_YEAR && !FISCAL_YEARS.includes(fiscalYear)) {
      throw new BadRequestException(`Unsupported fiscal year: ${fiscalYear}`);
    }
    const [rows, budgetHeads] = await Promise.all([
      fiscalYear === TOTAL_FISCAL_YEAR
        ? this.findAllYearsTotal()
        : this.findAll(fiscalYear),
      this.prisma.budgetHead.findMany({ orderBy: { code: 'asc' } }),
    ]);
    const totals = rows.reduce((acc, r) => ({
      prov215: acc.prov215 + r.prov215,
      rel215: acc.rel215 + r.rel215,
      exp215: acc.exp215 + r.exp215,
      prov224: acc.prov224 + r.prov224,
      rel224: acc.rel224 + r.rel224,
      exp224: acc.exp224 + r.exp224,
      prov233: acc.prov233 + r.prov233,
      rel233: acc.rel233 + r.rel233,
      exp233: acc.exp233 + r.exp233,
    }), {
      prov215: 0, rel215: 0, exp215: 0,
      prov224: 0, rel224: 0, exp224: 0,
      prov233: 0, rel233: 0, exp233: 0,
    });

    const grandProv = totals.prov215 + totals.prov224 + totals.prov233;
    const grandRelease = totals.rel215 + totals.rel224 + totals.rel233;
    const grandExp = totals.exp215 + totals.exp224 + totals.exp233;
    const bills = await this.prisma.bill.findMany({
      select: { cat: true, amount: true, clearedFY: true, date: true },
    });
    const cleared = bills.filter((bill) => bill.cat === 'cleared');
    const clearedFYAmt = cleared.reduce((sum, bill) => {
      const billFY = bill.clearedFY || clearedFYOf(bill.date);
      return sum + (fiscalYear === TOTAL_FISCAL_YEAR || billFY === fiscalYear ? bill.amount : 0);
    }, 0);
    const otherFYAmt = cleared.reduce((sum, bill) => {
      const billFY = bill.clearedFY || clearedFYOf(bill.date);
      return sum + (fiscalYear !== TOTAL_FISCAL_YEAR && billFY && billFY !== fiscalYear ? bill.amount : 0);
    }, 0);

    return {
      fiscalYear,
      fiscalYears: [...FISCAL_YEARS, TOTAL_FISCAL_YEAR],
      rows,
      budgetHeads,
      totals,
      grandProv,
      grandRelease,
      grandExp,
      balance: grandRelease - grandExp,
      utilizationPct: pct(grandExp, grandRelease),
      fyCrossCheck: {
        clearedFYAmt,
        clearedFYCount: cleared.filter((bill) => fiscalYear === TOTAL_FISCAL_YEAR || (bill.clearedFY || clearedFYOf(bill.date)) === fiscalYear).length,
        otherFYAmt,
        otherFYCount: cleared.filter((bill) => {
          const billFY = bill.clearedFY || clearedFYOf(bill.date);
          return fiscalYear !== TOTAL_FISCAL_YEAR && Boolean(billFY && billFY !== fiscalYear);
        }).length,
        notCleared: bills.filter((bill) => bill.cat !== 'cleared').length,
      },
    };
  }

  private async findAllYearsTotal(): Promise<BudgetRow[]> {
    const rows = await this.prisma.budget.findMany({
      orderBy: { code: 'asc' },
      include: { objectHead: true },
    });
    const totals = new Map<string, BudgetRow>();

    for (const row of rows) {
      const total = totals.get(row.code) || {
        id: `total:${row.code}`,
        fiscalYear: TOTAL_FISCAL_YEAR,
        code: row.code,
        name: row.name,
        nameMr: row.nameMr,
        prov215: 0,
        rel215: 0,
        exp215: 0,
        prov224: 0,
        rel224: 0,
        exp224: 0,
        prov233: 0,
        rel233: 0,
        exp233: 0,
        objectHead: row.objectHead,
      };
      total.prov215 += row.prov215;
      total.rel215 += row.rel215;
      total.exp215 += row.exp215;
      total.prov224 += row.prov224;
      total.rel224 += row.rel224;
      total.exp224 += row.exp224;
      total.prov233 += row.prov233;
      total.rel233 += row.rel233;
      total.exp233 += row.exp233;
      totals.set(row.code, total);
    }

    return [...totals.values()];
  }
}
