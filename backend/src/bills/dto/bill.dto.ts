import { IsString, IsNumber, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateBillDto {
  @IsString()
  vendor!: string;

  @IsString()
  invoice!: string;

  @IsString()
  @IsOptional()
  efileNumber?: string | null;

  @IsDateString()
  @IsOptional()
  date: string | null = null;

  @IsNumber()
  amount!: number;

  @IsNumber()
  @IsOptional()
  amountSanctioned?: number | null;

  @IsBoolean()
  @IsOptional()
  onHold?: boolean;

  @IsString()
  @IsOptional()
  holdReason?: string | null;

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

  @IsString()
  @IsOptional()
  program?: string | null;

  @IsString()
  @IsOptional()
  district?: string | null;

  @IsString()
  @IsOptional()
  assignedUserId?: string | null;
}

export class UpdateBillDto {
  @IsString()
  @IsOptional()
  vendor?: string;

  @IsString()
  @IsOptional()
  invoice?: string;

  @IsString()
  @IsOptional()
  efileNumber?: string | null;

  @IsDateString()
  @IsOptional()
  date?: string | null;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsNumber()
  @IsOptional()
  amountSanctioned?: number | null;

  @IsBoolean()
  @IsOptional()
  onHold?: boolean;

  @IsString()
  @IsOptional()
  holdReason?: string | null;

  @IsString()
  @IsOptional()
  cat?: string;

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

  @IsString()
  @IsOptional()
  program?: string | null;

  @IsString()
  @IsOptional()
  district?: string | null;

  @IsString()
  @IsOptional()
  assignedUserId?: string | null;
}
