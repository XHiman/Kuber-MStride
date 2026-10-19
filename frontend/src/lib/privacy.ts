// Masks bank/account-like numbers in free text before it is shown or exported.
// A run of 9–18 digits (spaces or dashes allowed between groups) keeps only its last 4 digits:
// "A/c 123456789012" → "A/c XXXX XXXX 9012". Applied to free-text fields only (status, remarks,
// attribute, notes) — never to invoice or e-file numbers, which are reference codes, not personal data.
const ACCOUNT_LIKE = /(?<![\dA-Za-z])\d(?:[ -]?\d){8,17}(?![\dA-Za-z])/g;

export function maskAccountNumbers(text: string): string;
export function maskAccountNumbers(text: string | null | undefined): string | null | undefined;
export function maskAccountNumbers(text: string | null | undefined) {
  if (!text) return text;
  return text.replace(ACCOUNT_LIKE, match => {
    const digits = match.replace(/\D/g, '');
    return `XXXX XXXX ${digits.slice(-4)}`;
  });
}
