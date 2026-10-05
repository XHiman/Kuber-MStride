const DEVELOPMENT_ADMIN_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
];

export function getAdminAllowedOrigins(): string[] {
  const configured = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map(value => normalizeOrigin(value))
    .filter((origin): origin is string => origin !== null);
  if (configured.length) return [...new Set(configured)];
  return process.env.NODE_ENV === 'production' ? [] : DEVELOPMENT_ADMIN_ORIGINS;
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
