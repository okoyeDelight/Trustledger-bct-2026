import { neon } from '@neondatabase/serverless';
let cachedURL, cachedSQL;
export function query(text, params=[]) {
  const url=process.env.DATABASE_URL;
  if (!url) throw Object.assign(new Error('Database not configured'), {statusCode:503});
  if (!cachedSQL || url!==cachedURL) {
    cachedURL=url; cachedSQL=neon(url);
  }
  return cachedSQL.query(text,params);
}
