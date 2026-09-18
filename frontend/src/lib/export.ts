/**
 * Download a CSV file from an array of objects.
 * @param data - rows to export (each row is Record<string, unknown>)
 * @param filename - name without extension (defaults to "export")
 */
export function downloadCSV(data: Record<string, unknown>[], filename = 'export') {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const escape = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    // Wrap in quotes if the value contains comma, quote, or newline
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csv = [headers.join(','), ...data.map(row => headers.map(h => escape(row[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
