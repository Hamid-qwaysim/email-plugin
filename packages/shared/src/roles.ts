/** Platform roles. Role separation is enforced server-side on every request. */
export const ROLES = [
  'super_admin', // our staff — full platform access
  'support', // our staff — read + limited actions, audited
  'agency_owner', // owns an agency org and its client stores
  'agency_member', // agency team member, scoped by client access toggles
  'merchant_owner', // owns a merchant org
  'merchant_member', // merchant team member
] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = ['super_admin', 'support'];
export const AGENCY_ROLES: Role[] = ['agency_owner', 'agency_member'];
export const MERCHANT_ROLES: Role[] = ['merchant_owner', 'merchant_member'];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function canManageOrg(role: Role): boolean {
  return role === 'super_admin' || role === 'agency_owner' || role === 'merchant_owner';
}
