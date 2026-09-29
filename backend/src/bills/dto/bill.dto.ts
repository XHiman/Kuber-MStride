import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateBillDto {
  @IsString()
  vendor!: string;

  @IsString()
  invoice!: string;

  @IsDateString()
  @IsOptional()
  date: string | null = null;

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

  @IsString()
  @IsOptional()
  budgetCode?: string;

  @IsString()
  @IsOptional()
  objectHead?: string;

  @IsString()
  @IsOptional()
  transferId?: string | null;
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
  date?: string | null;

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

  @IsString()
  @IsOptional()
  bucket?: string;

  @IsString()
  @IsOptional()
  budgetCode?: string;

  @IsString()
  @IsOptional()
  objectHead?: string;

  @IsString()
  @IsOptional()
  transferId?: string | null;
}
