import { useState } from 'react';
import { copyCSVToClipboard, downloadCSV } from '../lib/export';
import { useAppSettings } from '../lib/appSettings';

export default function ExportActions({
  getRows,
  filename,
}: {
  getRows: () => Record<string, unknown>[];
  filename: string;
}) {
  const { t } = useAppSettings();
  const [copiedData, setCopiedData] = useState<Record<string, unknown>[] | null>(null);
  const [message, setMessage] = useState('');

  async function copyExport() {
    const rows = getRows();
    try {
      await copyCSVToClipboard(rows);
      setCopiedData(rows);
      setMessage(t('Copied export to clipboard.'));
    } catch (error) {
      setCopiedData(null);
      setMessage(error instanceof Error ? error.message : t('Could not copy the export.'));
    }
  }

  return (
    <div className="export-actions">
      <button className="btn export-btn" type="button" onClick={copyExport}>▣ {t('Copy export')}</button>
      {copiedData && (
        <button className="btn" type="button" onClick={() => downloadCSV(copiedData, filename)}>
          ↓ {t('Download CSV')}
        </button>
      )}
      {message && <span className="export-status" role="status">{message}</span>}
    </div>
  );
}
