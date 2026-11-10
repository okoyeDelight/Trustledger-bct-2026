// TrustLedger role rules, independent of any frontend or authentication provider.
// Actual authorization must use verified Clerk JWT claims AND a server-loaded membership row.
export const ROLES = Object.freeze(['operator', 'reviewer', 'admin']);
export const PERMISSIONS = Object.freeze({
  operator: Object.freeze(['incident:read', 'incident:report', 'investigation:write', 'investigation:submit']),
  reviewer: Object.freeze(['incident:read', 'review:decide', 'followup:write']),
  admin: Object.freeze(['incident:read', 'source:manage', 'membership:manage'])
});

export function membershipAllows(membership, permission) {
  return Boolean(
    membership && membership.active === true &&
    ROLES.includes(membership.role) &&
    PERMISSIONS[membership.role].includes(permission)
  );
}

export function canDecideReview(membership, actorId, submittedById) {
  return Boolean(
    membershipAllows(membership, 'review:decide') &&
    typeof actorId === 'string' && actorId.length > 0 &&
    actorId !== submittedById
  );
}

export function activeMembership(row, expectedOrgId, userId) {
  if (!row || row.active !== true || !ROLES.includes(row.role)) return null;
  if (row.clerk_org_id !== expectedOrgId || row.clerk_user_id !== userId) return null;
  return Object.freeze({
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    role: row.role,
    active: true
  });
}

export function isAllowedOrigin(claimAzp, expectedOrigin) {
  // An asserted authorized party MUST match the explicitly configured site.
  return typeof expectedOrigin === 'string' && /^https:\/\//.test(expectedOrigin) &&
    (claimAzp === undefined || claimAzp === expectedOrigin);
}
