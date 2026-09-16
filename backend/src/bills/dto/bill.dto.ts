import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateBillDto {
  @IsString()
  vendor!: string;

  @IsString()
  invoice!: string;

  @IsDateString()
  @IsOptional()
  date: Date | null = null;

  @IsNumber()
  amount!: number;

  @IsString()
  status!: string;

  @IsString()
  @IsOptional()
  attribute: string | null = null;

  @IsString()
  @IsOptional()
  note: string | null = null;

  @IsNumber()
  @IsOptional()
  sr: number | null = null;

  @IsString()
  @IsOptional()
  bucket: string = '';

  @IsString()
  @IsOptional()
  cat: string = 'in_progress';

  @IsNumber()
  @IsOptional()
  days: number | null = null;

  @IsString()
  @IsOptional()
  source: string = 'user';
}

export class UpdateBillDto {
  @IsString()
  @IsOptional()
  vendor?: string;

  @IsString()
  @IsOptional()
  invoice?: string;

  @IsDateString()
  @IsOptional()
  date?: Date;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  attribute?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
