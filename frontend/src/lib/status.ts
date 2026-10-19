// Status language: stage glossary and derived "reason" codes.
// Reasons are computed for display only. Stored status/attribute/invoice text is never rewritten,
// so stage inference (classifyStatus on the backend) and every total stay unchanged.
import { STAGES, type Bill } from '../types';

export type ReasonCode =
  | 'handover_awaited'
  | 'missing_invoice_no'
  | 'missing_invoice_date'
  | 'missing_efile_no'
  | 'under_query'
  | 'needs_approval'
  | 'not_recorded';

export const REASONS: Record<ReasonCode, { label: string; action: string }> = {
  handover_awaited: { label: 'Awaiting handover data', action: 'Follow up with the vendor/DSU for handover data.' },
  missing_invoice_no: { label: 'Missing invoice no.', action: 'Enter the invoice number from the vendor invoice.' },
  missing_invoice_date: { label: 'Missing invoice date', action: 'Enter the invoice date so the bill can be aged.' },
  missing_efile_no: { label: 'Missing e-file no.', action: 'Record the e-office file number for this bill.' },
  under_query: { label: 'Under query', action: 'Resolve the query noted in the hold remark.' },
  needs_approval: { label: 'Needs approval', action: 'Obtain the pending approval, then move the bill on.' },
  not_recorded: { label: 'Reason not recorded', action: 'Check the bill and record its current status.' },
};

/** Stage glossary, in pipeline order, plus the on-hold exception state. */
export const STAGE_GLOSSARY: { stage: string; label: string; definition: string }[] = [
  { stage: 'Invoice Raised', label: 'Invoice raised', definition: 'The vendor or DSU invoice has been received and logged. Waiting for the PMC to check it.' },
  { stage: 'PMC Check Pending', label: 'PMC check', definition: 'The PMC is verifying the invoice against deliverables and reports.' },
  { stage: 'TFC Committee Approval', label: 'TFC approval', definition: 'Waiting for the TFC/TEC committee to approve payment.' },
  { stage: 'File Approval Pending', label: 'File approval pending', definition: 'Committee-approved. The payment file is put up for sign-off before it goes to the treasury.' },
  { stage: 'Sent to Treasury', label: 'Sent to treasury', definition: 'The bill has been submitted to the treasury and is awaiting clearance.' },
  { stage: 'Cleared by Treasury', label: 'Cleared by treasury', definition: 'The treasury has passed the bill and payment is released. Counted as cleared.' },
];
export const ON_HOLD_DEFINITION = 'Paused at its current stage because of an objection or missing information. A hold remark explains why; the bill keeps its stage.';

/** URL slugs for ?stage=…, in pipeline order. */
export const STAGE_SLUGS: Record<string, string> = {
  'Invoice Raised': 'invoice',
  'PMC Check Pending': 'pmc',
  'TFC Committee Approval': 'tfc',
  'File Approval Pending': 'file',
  'Sent to Treasury': 'treasury',
  'Cleared by Treasury': 'cleared',
};

export function stageFromSlug(slug: string | null | undefined): string {
  return Object.entries(STAGE_SLUGS).find(([, value]) => value === slug)?.[0] ?? '';
}

/**
 * Stage moves recorded in the given calendar month, keyed by the stage moved into.
 * Only 'tracked' history entries count: 'created' rows and import snapshots are not real moves.
 */
export function movesInMonth(bills: Pick<Bill, 'stageHistory'>[], now = new Date()): Record<string, number> {
  const moves: Record<string, number> = {};
  for (const bill of bills) {
    for (const entry of bill.stageHistory ?? []) {
      if (entry.source !== 'tracked') continue;
      const at = new Date(entry.enteredAt);
      if (at.getFullYear() !== now.getFullYear() || at.getMonth() !== now.getMonth()) continue;
      moves[entry.stage] = (moves[entry.stage] ?? 0) + 1;
    }
  }
  return moves;
}

export function stageLabel(stage: string): string {
  return STAGE_GLOSSARY.find(entry => entry.stage === stage)?.label ?? stage;
}

const PLACEHOLDER = /^\s*please\s*check\b[\s:.-]*/i;

/** True when a stored text field is the imported "Please Check" placeholder. */
export function isPlaceholder(value: string | null | undefined): boolean {
  return !!value && PLACEHOLDER.test(value);
}

/** Text after the placeholder, e.g. "Please Check From Apr 26" → "From Apr 26"; '' when nothing remains. */
export function placeholderRemainder(value: string | null | undefined): string {
  return (value ?? '').replace(PLACEHOLDER, '').trim();
}

type ReasonInput = Pick<Bill, 'invoice' | 'date' | 'efileNumber' | 'status' | 'bucket' | 'cat' | 'holdReason'>;

/**
 * Reasons a bill needs attention, most important first. Empty when nothing is missing.
 * Missing e-file no. is only flagged at File Approval Pending / Sent to Treasury: no bill records it
 * earlier, so flagging every bill would carry no information.
 */
export function deriveReasons(bill: ReasonInput): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  if (bill.cat === 'on_hold') {
    const remark = bill.holdReason ?? '';
    if (/hand\s*-?\s*over/i.test(remark)) reasons.push('handover_awaited');
    else if (/approv/i.test(remark)) reasons.push('needs_approval');
    else if (remark.trim()) reasons.push('under_query');
  }
  if (!bill.invoice?.trim() || isPlaceholder(bill.invoice)) reasons.push('missing_invoice_no');
  if (!bill.date) reasons.push('missing_invoice_date');
  const stageIndex = STAGES.indexOf(bill.bucket);
  if (!bill.efileNumber?.trim() && (stageIndex === 3 || stageIndex === 4)) reasons.push('missing_efile_no');
  if (isPlaceholder(bill.status) || !bill.status?.trim() || (bill.cat === 'on_hold' && !bill.holdReason?.trim())) {
    if (!reasons.length) reasons.push('not_recorded');
  }
  return reasons;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}
