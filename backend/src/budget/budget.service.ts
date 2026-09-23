import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { pct } from '../common/bill-utils';

export interface BudgetRow {
  id: string;
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

  async findAll(): Promise<BudgetRow[]> {
    const rows = await this.prisma.budget.findMany({
      orderBy: { code: 'asc' },
      include: { objectHead: true },
    });
    return rows.map(r => ({
      id: r.id,
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

  async update(code: string, data: Partial<Pick<BudgetRow, 'exp215' | 'exp224' | 'exp233'>>) {
    return this.prisma.budget.update({ where: { code }, data });
  }

  async getTotals() {
    const [rows, budgetHeads] = await Promise.all([
      this.findAll(),
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

    return {
      rows,
      budgetHeads,
      totals,
      grandProv,
      grandExp,
      balance: grandProv - grandExp,
      utilizationPct: pct(grandExp, grandProv),
    };
  }
}
