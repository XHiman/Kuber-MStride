import { useEffect, useId, useRef, useState } from 'react';
import { useAppSettings } from '../lib/appSettings';

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (note: string) => Promise<void> | void;
  onCancel: () => void;
};

/**
 * Confirms a status change and asks why. The note is optional and goes into the bill's audit trail.
 * Native <dialog>: Esc cancels, focus starts in the note field and returns to the opener on close.
 */
export default function ChangeNoteDialog({ title, description, confirmLabel, onConfirm, onCancel }: Props) {
  const { t } = useAppSettings();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.showModal?.();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onConfirm(note.trim());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('Could not save the change.'));
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="note-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
      <form method="dialog" onSubmit={event => void submit(event)}>
        <h2 id={titleId}>{title}</h2>
        <p className="note-dialog-desc">{description}</p>
        <label htmlFor={noteId}>{t('Reason for change')} <span className="note">({t('optional, saved in the bill history')})</span></label>
        <textarea id={noteId} value={note} maxLength={500} autoFocus onChange={event => setNote(event.target.value)} placeholder={t('e.g. PMC accepted the deliverable report')} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>{t('Cancel')}</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? t('Saving…') : confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
