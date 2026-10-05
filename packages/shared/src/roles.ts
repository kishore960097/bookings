export type UserRole = 'consumer' | 'owner' | 'admin';

export const DEFAULT_ROLE: UserRole = 'consumer';

export const ROLE_LABELS: Record<UserRole, string> = {
  consumer: 'Client',
  owner: 'Owner',
  admin: 'Admin',
};

export function normalizeUserRole(role: unknown): UserRole | null {
  if (role === undefined || role === null || role === 'consumer' || role === 'customer' || role === 'client') {
    return 'consumer';
  }
  if (role === 'owner') {
    return 'owner';
  }
  if (role === 'admin') {
    return 'admin';
  }
  return null;
}

export function getAuthorizedRoles(roles?: readonly UserRole[] | null): UserRole[] {
  const uniqueRoles = new Set<UserRole>([DEFAULT_ROLE]);
  roles?.forEach((role) => uniqueRoles.add(role));
  return Array.from(uniqueRoles);
}

export function hasRole(roles: readonly UserRole[] | undefined | null, role: UserRole): boolean {
  return getAuthorizedRoles(roles).includes(role);
}

export function canSwitchRole(roles: readonly UserRole[] | undefined | null, nextRole: UserRole): boolean {
  return hasRole(roles, nextRole);
}

export function getNextRole(activeRole: UserRole, roles: readonly UserRole[] | undefined | null): UserRole | null {
  const authorizedRoles = getAuthorizedRoles(roles);
  const nextRole = activeRole === 'owner' ? 'consumer' : 'owner';
  return authorizedRoles.includes(nextRole) ? nextRole : null;
}
