// Step 2: read-only server identity endpoint. Deploy only with NEW TrustLedger Neon/Clerk credentials.
// Never trust a role or facilityId supplied by the browser; both come from server DB rows.
import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { activeMembership, isAllowedOrigin } from '../src/access-policy.mjs';

let jwks;
let jwksIssuer;

function reply(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
}

function issuerUrl() {
  const raw = process.env.CLERK_JWT_ISSUER;
  if (!raw) return null;
  try {
    const uri = new URL(raw);
    // Fail closed for arbitrary insecure origins or URLs with userinfo / path.
    if (uri.protocol !== 'https:' || !uri.hostname || uri.username || uri.password ||
        uri.pathname !== '/' || uri.search || uri.hash) return null;
    return uri.origin;
  } catch { return null; }
}

async function verifiedSession(req) {
  const issuer = issuerUrl();
  const origin = process.env.TRUSTLEDGER_APP_ORIGIN;
  const auth = req.headers?.authorization;
  if (!issuer || !origin || !process.env.DATABASE_URL) {
    throw Object.assign(new Error('Account services are not configured'), { code: 503 });
  }
  if (typeof auth !== 'string' || !/^Bearer [^\s]+$/.test(auth)) {
    throw Object.assign(new Error('Sign-in required'), { code: 401 });
  }
  if (!jwks || jwksIssuer !== issuer) {
    jwks = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'));
    jwksIssuer = issuer;
  }
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(auth.slice(7), jwks, {
      issuer, algorithms: ['RS256'], clockTolerance: 5
    }));
  } catch {
    throw Object.assign(new Error('Invalid or expired sign-in'), { code: 401 });
  }
  if (!isAllowedOrigin(claims.azp, origin)) {
    throw Object.assign(new Error('Wrong sign-in origin'), { code: 403 });
  }
  const userId = claims.sub;
  const orgId = claims.o?.id || claims.org_id;
  if (typeof userId !== 'string' || !userId.startsWith('user_') ||
      typeof orgId !== 'string' || !orgId.startsWith('org_')) {
    throw Object.assign(new Error('Choose an approved facility organization'), { code: 403 });
  }
  return { userId, orgId };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed' });
  try {
    const { userId, orgId } = await verifiedSession(req);
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql.query(
      'SELECT f.id AS facility_id, f.name AS facility_name, f.clerk_org_id, m.clerk_user_id, m.role, m.active FROM facility_memberships m JOIN facilities f ON f.id = m.facility_id WHERE f.clerk_org_id = $1 AND m.clerk_user_id = $2 LIMIT 1',
      [orgId, userId]
    );
    const membership = activeMembership(rows[0], orgId, userId);
    if (!membership) return reply(res, 403, { error: 'Facility membership not approved' });
    return reply(res, 200, { userId, ...membership });
  } catch (error) {
    const code = [401, 403, 503].includes(error?.code) ? error.code : 500;
    if (code === 500) console.error('TrustLedger /api/me error', error?.name || 'unknown');
    return reply(res, code, { error: code === 500 ? 'Account request failed' : error.message });
  }
}
