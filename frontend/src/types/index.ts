export type BillCategory = 'cleared' | 'in_progress' | 'on_hold';
export type TransferStatus = 'transferred' | 'minutes_awaited';
export const FISCAL_YEARS = [
  'FY 2024-25',
  'FY 2025-26',
  'FY 2026-27',
  'FY 2027-28',
  'FY 2028-29',
  'FY 2029-30',
];

export interface Bill {
  id: string;
  sr: number | null;
  vendor: string;
  invoice: string;
  date: string | null;
  amount: number;
  budgetCode: string | null;
  objectHead: string | null;
  transferId: string | null;
  bucket: string;
  cat: BillCategory;
  status: string;
  attribute: string | null;
  note: string | null;
  days: number | null;
  clearedFY: string | null;
  source: string;
  _days?: number | null;
  _clearedFY?: string | null;
}

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

export interface Transfer {
  id: string;
  recipient: string;
  purpose: string;
  objectCode: string;
  fiscalYear: string;
  budgetCode: string | null;
  amount: number;
  orderDate: string | null;
  status: TransferStatus;
  utilized: number;
  remarks: string | null;
}

export interface District {
  id: string;
  district: string;
  division: string;
  amount: number;
  releaseDate: string | null;
  remarks: string | null;
}

export const STAGES = ['Invoice Raised', 'PMC Check', 'TFC/TEC Committee Approval', 'Put Up on File', 'Sent to Treasury', 'Treasury Clearance'];
export const STAGE_SHORT = ['Invoice raised', 'PMC check', 'TFC / TEC approval', 'Put up on file', 'Sent to treasury', 'Treasury clearance'];
export const STAGE_VAR = ['--stage-1', '--stage-2', '--stage-3', '--stage-4', '--stage-5', '--stage-6'];
export const PROCESS_LABELS = ['Raising of invoice', 'Check by PMC', 'TFC / TEC (Bill) committee approval', 'Putting it up on file', 'Sent to treasury', 'Clearance by treasury'];
export const BUDGET_CODE_ORDER = ['01', '06', '10', '11', '13', '14', '16', '17', '21', '24', '26', '27', '28', '31'];
