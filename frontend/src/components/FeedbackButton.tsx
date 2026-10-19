import { useEffect, useId, useRef, useState } from 'react';
import { apiClient } from '../lib/api';
import { useAppSettings } from '../lib/appSettings';
import type { ResearchPage } from '../lib/research';
import { useToast } from './Toast';

const MAX = 280;

/** "Feedback" on every page: one line, saved with the page name and nothing that identifies the user. */
export default function FeedbackButton({ page }: { page: ResearchPage }) {
  const { t } = useAppSettings();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await apiClient.research.feedback({ page, comment: comment.trim() });
      toast(t('Thanks — your feedback was saved.'));
      setComment('');
      setOpen(false);
    } catch (error) {
      toast(error instanceof Error ? t(error.message) : t('Could not send feedback.'), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="feedback-button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">✎ </span>{t('Feedback')}
      </button>
      <dialog ref={dialogRef} className="note-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)}>
        <form onSubmit={event => void submit(event)}>
          <h2 id={titleId}>{t('Send feedback')}</h2>
          <label htmlFor={inputId}>{t('What could be clearer or faster on this page?')}</label>
          <input
            id={inputId}
            type="text"
            maxLength={MAX}
            value={comment}
            onChange={event => setComment(event.target.value)}
            aria-describedby={hintId}
            required
          />
          <p id={hintId} className="note">
            {comment.length}/{MAX} · {t('Saved with the page name only, not your name. Please do not include personal details.')}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>{t('Cancel')}</button>
            <button type="submit" className="btn primary" disabled={busy || !comment.trim()}>{busy ? t('Sending…') : t('Send feedback')}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
