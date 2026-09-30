import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string) {
    if (query.length < 2) return [];
    const contains = { contains: query };
    const numericValue = Number(query);
    const numericAmount = query && Number.isFinite(numericValue) ? numericValue : null;
    const candidateDate = /^\d{4}-\d{2}-\d{2}$/.test(query) ? new Date(`${query}T00:00:00.000Z`) : null;
    const dateValue = candidateDate && !Number.isNaN(candidateDate.getTime()) &&
      candidateDate.toISOString().slice(0, 10) === query
      ? candidateDate
      : null;
    const [bills, budgets, transfers, districts, users] = await Promise.all([
      this.prisma.bill.findMany({
        where: {
          OR: [
            { vendor: contains },
            { invoice: contains },
            { status: contains },
            { program: contains },
            { district: contains },
            { attribute: contains },
            { note: contains },
            { budgetCode: contains },
            { objectHead: contains },
            { assignedUser: { name: contains } },
            { cat: contains },
            { bucket: contains },
            ...(numericAmount === null ? [] : [{ amount: numericAmount }]),
            ...(dateValue === null ? [] : [{ date: dateValue }]),
          ],
        },
        select: { id: true, vendor: true, invoice: true, amount: true, status: true, program: true, district: true, assignedUser: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.budget.findMany({
        where: {
          OR: [
            { code: contains },
            { name: contains },
            { nameMr: contains },
            { fiscalYear: contains },
            ...(numericAmount === null ? [] : [
              { prov215: numericAmount },
              { exp215: numericAmount },
              { prov224: numericAmount },
              { exp224: numericAmount },
              { prov233: numericAmount },
              { exp233: numericAmount },
            ]),
          ],
        },
        select: { id: true, code: true, name: true, fiscalYear: true },
        orderBy: [{ fiscalYear: 'desc' }, { code: 'asc' }],
        take: 8,
      }),
      this.prisma.transfer.findMany({
        where: {
          OR: [
            { recipient: contains },
            { purpose: contains },
            { objectCode: contains },
            { remarks: contains },
            { status: contains },
            { fiscalYear: contains },
            { budgetCode: contains },
            ...(numericAmount === null ? [] : [{ amount: numericAmount }]),
            ...(dateValue === null ? [] : [{ orderDate: dateValue }]),
          ],
        },
        select: { id: true, recipient: true, purpose: true, objectCode: true, amount: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.district.findMany({
        where: {
          OR: [
            { district: contains },
            { division: contains },
            { remarks: contains },
            ...(numericAmount === null ? [] : [{ amount: numericAmount }]),
            ...(dateValue === null ? [] : [{ releaseDate: dateValue }]),
          ],
        },
        select: { id: true, district: true, division: true, amount: true },
        orderBy: { district: 'asc' },
        take: 8,
      }),
      this.prisma.user.findMany({
        where: { OR: [{ name: contains }, { programs: contains }, { districts: contains }] },
        select: { id: true, name: true, programs: true, districts: true },
        orderBy: { name: 'asc' },
        take: 8,
      }),
    ]);
    return [
      ...bills.map(row => ({
        id: row.id,
        entity: 'Bill',
        tab: 'bills',
        title: row.vendor,
        subtitle: [row.invoice, row.status, row.program, row.district, row.assignedUser?.name, `₹${row.amount}`].filter(Boolean).join(' · '),
      })),
      ...budgets.map(row => ({ id: row.id, entity: 'Budget', tab: 'budget', fiscalYear: row.fiscalYear, title: `${row.code} · ${row.name}`, subtitle: row.fiscalYear })),
      ...transfers.map(row => ({ id: row.id, entity: 'Transfer', tab: 'transfers', title: row.recipient, subtitle: `${row.purpose} · ${row.objectCode} · ₹${row.amount}` })),
      ...districts.map(row => ({ id: row.id, entity: 'District', tab: 'transfers', title: row.district, subtitle: `${row.division} · ₹${row.amount}` })),
      ...users.map(row => ({
        id: row.id,
        entity: 'User',
        tab: 'dashboard',
        title: row.name,
        subtitle: [...JSON.parse(row.programs) as string[], ...JSON.parse(row.districts) as string[]].join(' · '),
      })),
    ];
  }
}
