import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { clearedFYOf, FISCAL_YEARS, pct } from '../common/bill-utils';

export interface BudgetRow {
  id: string;
  fiscalYear: string;
  code: string;
  name: string;
  nameMr: string;
  prov215: number;
  exp215: number;
  prov224: number;
  exp224: number;
  prov233: number;
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
      exp215: r.exp215,
      prov224: r.prov224,
      exp224: r.exp224,
      prov233: r.prov233,
      exp233: r.exp233,
      objectHead: r.objectHead,
    }));
  }

  async update(fiscalYear: string, code: string, data: Partial<Pick<BudgetRow, 'exp215' | 'exp224' | 'exp233'>>) {
    return this.prisma.budget.update({
      where: { fiscalYear_code: { fiscalYear, code } },
      data,
    });
  }

  async getTotals(fiscalYear: string = 'FY 2026-27') {
    if (!FISCAL_YEARS.includes(fiscalYear)) {
      throw new BadRequestException(`Unsupported fiscal year: ${fiscalYear}`);
    }
    const [rows, budgetHeads] = await Promise.all([
      this.findAll(fiscalYear),
      this.prisma.budgetHead.findMany({ orderBy: { code: 'asc' } }),
    ]);
    const totals = rows.reduce((acc, r) => ({
      prov215: acc.prov215 + r.prov215,
      exp215: acc.exp215 + r.exp215,
      prov224: acc.prov224 + r.prov224,
      exp224: acc.exp224 + r.exp224,
      prov233: acc.prov233 + r.prov233,
      exp233: acc.exp233 + r.exp233,
    }), { prov215: 0, exp215: 0, prov224: 0, exp224: 0, prov233: 0, exp233: 0 });

    const grandProv = totals.prov215 + totals.prov224 + totals.prov233;
    const grandExp = totals.exp215 + totals.exp224 + totals.exp233;
    const bills = await this.prisma.bill.findMany({
      select: { cat: true, amount: true, clearedFY: true, date: true },
    });
    const cleared = bills.filter((bill) => bill.cat === 'cleared');
    const clearedFYAmt = cleared.reduce((sum, bill) => {
      const billFY = bill.clearedFY || clearedFYOf(bill.date);
      return sum + (billFY === fiscalYear ? bill.amount : 0);
    }, 0);
    const otherFYAmt = cleared.reduce((sum, bill) => {
      const billFY = bill.clearedFY || clearedFYOf(bill.date);
      return sum + (billFY && billFY !== fiscalYear ? bill.amount : 0);
    }, 0);

    return {
      fiscalYear,
      fiscalYears: FISCAL_YEARS,
      rows,
      budgetHeads,
      totals,
      grandProv,
      grandExp,
      balance: grandProv - grandExp,
      utilizationPct: pct(grandExp, grandProv),
      fyCrossCheck: {
        clearedFYAmt,
        clearedFYCount: cleared.filter((bill) => (bill.clearedFY || clearedFYOf(bill.date)) === fiscalYear).length,
        otherFYAmt,
        otherFYCount: cleared.filter((bill) => {
          const billFY = bill.clearedFY || clearedFYOf(bill.date);
          return Boolean(billFY && billFY !== fiscalYear);
        }).length,
        notCleared: bills.filter((bill) => bill.cat !== 'cleared').length,
      },
    };
  }
}
