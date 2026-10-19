import { useEffect, useId, useRef, useState } from 'react';
import { useAppSettings } from '../lib/appSettings';
import { ON_HOLD_DEFINITION, REASONS, STAGE_GLOSSARY, deriveReasons, isPlaceholder, placeholderRemainder } from '../lib/status';
import type { Bill } from '../types';
import { maskAccountNumbers } from '../lib/privacy';

/** "What do these mean?" link that opens the stage and reason glossary in a modal dialog. */
export function GlossaryButton() {
  const { t } = useAppSettings();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button type="button" className="link-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">ⓘ</span> {t('What do these mean?')}
      </button>
      <dialog
        ref={dialogRef}
        className="glossary-dialog"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <div className="glossary-body">
          <div className="glossary-head">
            <h2 id={titleId}>{t('Status glossary')}</h2>
            <button type="button" className="btn" onClick={() => setOpen(false)}>{t('Close')}</button>
          </div>
          <h3>{t('Pipeline stages')}</h3>
          <dl className="glossary-list">
            {STAGE_GLOSSARY.map((entry, index) => (
              <div key={entry.stage}>
                <dt><span className="dot" style={{ background: `var(--stage-${index + 1})` }} aria-hidden="true" />{index + 1}. {t(entry.label)}</dt>
                <dd>{t(entry.definition)}</dd>
              </div>
            ))}
            <div>
              <dt><span aria-hidden="true">⚠ </span>{t('On hold / exception')}</dt>
              <dd>{t(ON_HOLD_DEFINITION)}</dd>
            </div>
          </dl>
          <h3>{t('Action reasons')}</h3>
          <dl className="glossary-list">
            {Object.entries(REASONS).map(([code, reason]) => (
              <div key={code}><dt>{t(reason.label)}</dt><dd>{t(reason.action)}</dd></div>
            ))}
          </dl>
        </div>
      </dialog>
    </>
  );
}

/** Small stage label with a keyboard-reachable definition tooltip. */
export function StageTerm({ stage, index }: { stage: string; index: number }) {
  const { t } = useAppSettings();
  const tipId = useId();
  const entry = STAGE_GLOSSARY.find(item => item.stage === stage);
  if (!entry) return <>{t(stage)}</>;
  return (
    <span className="term" tabIndex={0} aria-describedby={tipId}>
      {index + 1}. {t(entry.label)}
      <span role="tooltip" id={tipId} className="term-tip">{t(entry.definition)}</span>
    </span>
  );
}

/** Reason chips for a bill; renders nothing when the bill has no open reason. */
export function ReasonBadges({ bill, max = 2 }: { bill: Bill; max?: number }) {
  const { t } = useAppSettings();
  const reasons = deriveReasons(bill).slice(0, max);
  if (!reasons.length) return null;
  return (
    <span className="reason-list">
      {reasons.map(code => (
        <span key={code} className={`reason-badge ${code === 'not_recorded' ? 'is-unknown' : ''}`} title={t(REASONS[code].action)}>
          <span aria-hidden="true">!</span> {t(REASONS[code].label)}
        </span>
      ))}
    </span>
  );
}

/**
 * Free-text field that may hold the imported "Please Check" placeholder. Account-like numbers are masked,
 * except for `reference` fields (invoice numbers), which are codes rather than personal data.
 */
export function RecordedText({ value, empty = '—', reference = false }: { value: string | null | undefined; empty?: string; reference?: boolean }) {
  const { t, language } = useAppSettings();
  const shown = reference ? value : maskAccountNumbers(value);
  // Recorded text is English data; mark it inside the Marathi UI.
  if (!isPlaceholder(shown)) return shown?.trim() ? <span lang={language === 'mr' ? 'en' : undefined}>{shown.trim()}</span> : <>{empty}</>;
  const rest = placeholderRemainder(shown);
  return (
    <>
      <span className="not-recorded">{t('Not recorded')}</span>
      {rest && <> · {rest}</>}
    </>
  );
}

// Simple line icons, one per stage (stroke uses currentColor).
const STAGE_ICON_PATHS: Record<string, string[]> = {
  'Invoice Raised': ['M6 2h9l5 5v15H6z', 'M14 2v6h6', 'M9 13h8', 'M9 17h6'],
  'PMC Check Pending': ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M21 21l-5-5', 'M8 11l2 2 4-4'],
  'TFC Committee Approval': ['M9 7a3 3 0 1 0 0 .01', 'M17 8a2.5 2.5 0 1 0 0 .01', 'M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6', 'M15 14.5c3 0 6 2 6 5.5'],
  'File Approval Pending': ['M3 6h6l2 2h10v12H3z', 'M12 12v4', 'M12 12h3'],
  'Sent to Treasury': ['M3 10l9-6 9 6', 'M5 10v8', 'M10 10v8', 'M14 10v8', 'M19 10v8', 'M3 20h18'],
  'Cleared by Treasury': ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M8 12l3 3 5-6'],
};

export function StageIcon({ stage, size = 16 }: { stage: string; size?: number }) {
  const paths = STAGE_ICON_PATHS[stage];
  if (!paths) return null;
  return (
    <svg className="stage-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths.map(d => <path key={d} d={d} />)}
    </svg>
  );
}
