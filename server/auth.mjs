import { createRemoteJWKSet, jwtVerify } from 'jose';

let cachedIssuer = '';
let cachedKeys;
function issuerURL() {
  const raw = process.env.TRUSTLEDGER_CLERK_ISSUER;
  if (!raw) throw Object.assign(new Error('Authentication not configured'), {statusCode:503});
  let u;
  try { u = new URL(raw); } catch { throw Object.assign(new Error('Authentication not configured'), {statusCode:503}); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      !u.hostname.includes('.')) {
    throw Object.assign(new Error('Invalid authentication configuration'), {statusCode:503});
  }
  return u.origin;
}
export async function verifyStaffSession(req) {
  const header = String(req.headers?.authorization ?? '');
  if (!header.startsWith('Bearer ') || header.length > 8000)
    throw Object.assign(new Error('Sign in required'), {statusCode:401});
  const issuer = issuerURL();
  if (!cachedKeys || issuer !== cachedIssuer) {
    cachedIssuer = issuer;
    cachedKeys = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'));
  }
  let claims;
  try {
    const verified = await jwtVerify(header.slice(7), cachedKeys, {
      issuer, algorithms:['RS256'],clockTolerance:5
    });
    claims = verified.payload;
  } catch {
    throw Object.assign(new Error('Invalid or expired session'), {statusCode:401});
  }
  const origin = process.env.TRUSTLEDGER_PUBLIC_ORIGIN;
  if (claims.azp && (!origin || claims.azp !== origin))
    throw Object.assign(new Error('Session origin is not authorized'), {statusCode:403});
  if (typeof claims.sub !== 'string' || !/^user_[a-zA-Z0-9]{8,}$/.test(claims.sub))
    throw Object.assign(new Error('Invalid staff identity'), {statusCode:401});
  return {userId: claims.sub};
}
