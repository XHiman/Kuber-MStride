import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { bills: true } } },
    });
    return users.map(user => ({
      ...this.toProfile(user),
      assignedBillCount: user._count.bills,
    }));
  }

  async getProfile(id: string) {
    return this.toProfile(await this.prisma.user.findUniqueOrThrow({ where: { id } }));
  }

  async getDashboard(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const programs = this.parseList(user.programs);
    const districts = this.parseList(user.districts);
    const scopeFilters = [
      { assignedUserId: id },
      ...(programs.length ? [{ program: { in: programs } }] : []),
      ...(districts.length ? [{ district: { in: districts } }] : []),
    ];
    const [bills, districtRecords] = await Promise.all([
      this.prisma.bill.findMany({
        where: { OR: scopeFilters },
        orderBy: { updatedAt: 'desc' },
      }),
      districts.length
        ? this.prisma.district.findMany({
            where: { district: { in: districts } },
            orderBy: { district: 'asc' },
          })
        : Promise.resolve([]),
    ]);
    const pendingBills = bills.filter(bill => bill.cat !== 'cleared');
    return {
      user: this.toProfile(user),
      bills: bills.map(bill => ({
        ...bill,
        date: bill.date ? bill.date.toISOString().split('T')[0] : null,
      })),
      pendingTasks: pendingBills.length,
      onHoldBills: pendingBills.filter(bill => bill.cat === 'on_hold').length,
      pendingAmount: pendingBills.reduce((sum, bill) => sum + bill.amount, 0),
      districtRecords: districtRecords.map(record => ({
        ...record,
        releaseDate: record.releaseDate ? record.releaseDate.toISOString().split('T')[0] : null,
      })),
    };
  }

  toProfile(user: { id: string; name: string; programs: string; districts: string }) {
    return {
      id: user.id,
      name: user.name,
      programs: this.parseList(user.programs),
      districts: this.parseList(user.districts),
    };
  }

  private parseList(value: string): string[] {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
      throw new Error('Stored user scope is not a valid string list.');
    }
    return parsed;
  }

}
