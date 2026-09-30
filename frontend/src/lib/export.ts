/**
 * Download a CSV file from an array of objects.
 * @param data - rows to export (each row is Record<string, unknown>)
 * @param filename - name without extension (defaults to "export")
 */
export function formatCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const escape = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return [headers.join(','), ...data.map(row => headers.map(h => escape(row[h])).join(','))].join('\r\n');
}

export async function copyCSVToClipboard(data: Record<string, unknown>[]): Promise<void> {
  if (!data.length) throw new Error('There is no data to export.');
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser context.');
  await navigator.clipboard.writeText(formatCSV(data));
}

export function downloadCSV(data: Record<string, unknown>[], filename = 'export') {
  if (!data.length) return;
  const blob = new Blob(['\uFEFF' + formatCSV(data)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
