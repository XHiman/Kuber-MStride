import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fmtShort } from '../common/bill-utils';

export interface DistrictRow {
  id: string;
  district: string;
  division: string;
  amount: number;
  releaseDate: string | null;
  remarks: string | null;
}

export type DistrictInput = Omit<DistrictRow, 'id'>;

@Injectable()
export class DistrictsService {
  constructor(private prisma: PrismaService) {}

  async create(data: DistrictInput) {
    if (!data.district.trim() || !data.division.trim()) {
      throw new BadRequestException('District and division are required.');
    }
    if (!Number.isFinite(data.amount) || data.amount < 0) {
      throw new BadRequestException('Released amount must be a non-negative number.');
    }
    return this.prisma.district.create({
      data: {
        ...data,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
      },
    });
  }

  async findAll(): Promise<DistrictRow[]> {
    const rows = await this.prisma.district.findMany({
      orderBy: [{ division: 'asc' }, { district: 'asc' }],
    });
    return rows.map(r => ({
      id: r.id,
      district: r.district,
      division: r.division,
      amount: r.amount,
      releaseDate: r.releaseDate ? r.releaseDate.toISOString().split('T')[0] : null,
      remarks: r.remarks,
    }));
  }

  async update(id: string, data: Partial<Omit<DistrictRow, 'id' | 'createdAt' | 'updatedAt'>>) {
    if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) {
      throw new BadRequestException('Released amount must be a non-negative number.');
    }
    return this.prisma.district.update({
      where: { id },
      data: {
        ...data,
        ...(data.releaseDate !== undefined && {
          releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        }),
      },
    });
  }

  async getStats() {
    const rows = await this.findAll();
    const released = rows.filter(r => r.amount > 0);
    const totalAmt = rows.reduce((s, r) => s + r.amount, 0);

    return {
      totalDistricts: rows.length,
      totalReleased: totalAmt,
      releasedCount: released.length,
      awaitingRelease: rows.length - released.length,
      designBrackets: '₹8 / 12 / 16 Cr',
    };
  }
}
