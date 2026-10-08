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
  efileNumber: string | null;
  date: string | null;
  amount: number;
  amountSanctioned: number | null;
  effectiveAmount?: number;
  budgetCode: string | null;
  objectHead: string | null;
  transferId: string | null;
  program: string | null;
  district: string | null;
  assignedUserId: string | null;
  bucket: string;
  cat: BillCategory;
  onHold: boolean;
  holdReason: string | null;
  status: string;
  attribute: string | null;
  note: string | null;
  days: number | null;
  clearedFY: string | null;
  source: string;
  stageHistory: BillStageHistoryEntry[];
  _days?: number | null;
  _clearedFY?: string | null;
}

export interface BillStageHistoryEntry {
  id: string;
  stage: string;
  enteredAt: string;
  source: string;
}

export interface BudgetRow {
  id: string;
  fiscalYear: string;
  code: string;
  name: string;
  nameMr: string;
  prov215: number;
  rel215: number;
  exp215: number;
  prov224: number;
  rel224: number;
  exp224: number;
  prov233: number;
  rel233: number;
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
  scopeType: 'program' | 'district' | null;
  districtFund: 'incentive_funds' | 'consultants_grant' | null;
  purpose: string;
  objectCode: string;
  fiscalYear: string;
  budgetCode: string | null;
  amount: number;
  orderDate: string | null;
  status: TransferStatus;
  utilized: number;
  utilizations: TransferUtilization[];
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  history: TransferHistoryEntry[];
}

export interface TransferUtilization {
  id: string;
  amount: number;
  utilizedAt: string;
  remarks: string | null;
  billId: string | null;
}

export interface TransferHistoryEntry {
  changedAt: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  programs: string[];
  districts: string[];
  assignedBillCount?: number;
}

export interface GlobalSearchResult {
  id: string;
  entity: string;
  tab: 'bills' | 'budget' | 'transfers' | 'dashboard';
  title: string;
  subtitle: string;
  fiscalYear?: string;
}

export interface District {
  id: string;
  district: string;
  division: string;
  amount: number;
  releaseDate: string | null;
  remarks: string | null;
}

export const STAGES = ['Invoice Raised', 'PMC Check Pending', 'TFC Committee Approval', 'File ApprovalPending', 'Sent to Treasury', 'Cleared by Treasury'];
export const STAGE_SHORT = ['Invoice raised', 'PMC Check', 'TFC approval', 'File Pending', 'Sent to treasury', 'Treasury clearance'];
export const STAGE_VAR = ['--stage-1', '--stage-2', '--stage-3', '--stage-4', '--stage-5', '--stage-6'];
export const PROCESS_LABELS = ['Invoice Raised', 'PMC Check Pending', 'TFC Committee Approval', 'File Approval Pending', 'Sent to Treasury', 'Cleared by Treasury'];
export const BUDGET_CODE_ORDER = ['01', '06', '10', '11', '13', '14', '16', '17', '21', '24', '26', '27', '28', '31'];
