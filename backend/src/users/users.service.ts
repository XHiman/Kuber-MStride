import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(deviceId: string, userAgent: string, ipAddress: string | null) {
    const device = await this.prisma.userDevice.upsert({
      where: { deviceId },
      create: { deviceId, userAgent, ipAddress, accessEnabled: false },
      update: { userAgent, ipAddress, lastSeenAt: new Date() },
      include: { user: true },
    });
    return {
      user: device.user ? this.toProfile(device.user) : null,
      accessEnabled: device.accessEnabled,
    };
  }

  async claimDevice(deviceId: string, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new BadRequestException('A user name is required.');

    return this.prisma.$transaction(async tx => {
      const device = await tx.userDevice.findUniqueOrThrow({ where: { deviceId }, include: { user: true } });
      if (device.user) {
        return {
          user: this.toProfile(device.user),
          accessEnabled: device.accessEnabled,
        };
      }

      const existingUser = await tx.user.findFirst({ where: { name: trimmedName } });
      const user = existingUser ?? await tx.user.create({ data: { name: trimmedName } });
      await tx.userDevice.update({
        where: { deviceId },
        data: { userId: user.id, accessEnabled: true },
      });
      return { user: this.toProfile(user), accessEnabled: true };
    });
  }

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { devices: true, bills: true } } },
    });
    return users.map(user => ({
      ...this.toProfile(user),
      deviceCount: user._count.devices,
      assignedBillCount: user._count.bills,
    }));
  }

  async update(id: string, data: { name?: string; programs?: string[]; districts?: string[] }) {
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException('A user name is required.');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.programs !== undefined && { programs: JSON.stringify(this.cleanList(data.programs)) }),
        ...(data.districts !== undefined && { districts: JSON.stringify(this.cleanList(data.districts)) }),
      },
    });
    return this.toProfile(user);
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

  private toProfile(user: { id: string; name: string; programs: string; districts: string }) {
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

  private cleanList(values: string[]): string[] {
    if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) {
      throw new BadRequestException('User programs and districts must be lists of names.');
    }
    return [...new Set(values.map(value => value.trim()).filter(Boolean))];
  }
}
