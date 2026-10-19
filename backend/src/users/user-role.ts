// TODO(roles): placeholder until proper role management exists. Only affects which bills the
// personal dashboard treats as "in scope"; it does NOT restrict API access (bills stay publicly readable).
export type UserRole = 'finance' | 'dsu';
export const USER_ROLES: UserRole[] = ['finance', 'dsu'];

export function normalizeRole(value: unknown): UserRole {
  return value === 'dsu' ? 'dsu' : 'finance';
}
