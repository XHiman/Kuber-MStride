import { useEffect, useId, useRef, useState } from 'react';
import { useAppSettings } from '../lib/appSettings';
import { ON_HOLD_DEFINITION, REASONS, STAGE_GLOSSARY, deriveReasons, isPlaceholder, placeholderRemainder } from '../lib/status';
import type { Bill } from '../types';

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

/** Free-text field that may hold the imported "Please Check" placeholder. */
export function RecordedText({ value, empty = '—' }: { value: string | null | undefined; empty?: string }) {
  const { t } = useAppSettings();
  if (!isPlaceholder(value)) return <>{value?.trim() || empty}</>;
  const rest = placeholderRemainder(value);
  return (
    <>
      <span className="not-recorded">{t('Not recorded')}</span>
      {rest && <> · {rest}</>}
    </>
  );
}
