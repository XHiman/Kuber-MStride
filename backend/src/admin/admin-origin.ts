const DEFAULT_ADMIN_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://mstride-kuber.onrender.com',
];

export function getAdminAllowedOrigins(): string[] {
  const configured = process.env.FRONTEND_ORIGIN
    ?.split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean) ?? [];
  return [...new Set([...DEFAULT_ADMIN_ORIGINS, ...configured])];
}

export function isAllowedAdminOrigin(origin: string | undefined): boolean {
  return origin !== undefined && getAdminAllowedOrigins().includes(origin.replace(/\/+$/, ''));
}
