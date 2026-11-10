export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ROLES = Object.freeze(['operator','reviewer','admin']);
export const MANUAL_CATEGORIES = Object.freeze(['equipment_problem','temperature_excursion','monitoring_gap','sensor_anomaly','other']);
export const canRead = role => ROLES.includes(role);
export const canReport = role => role === 'operator' || role === 'admin';
export const canReview = (role, actorId, reportAuthorId) =>
  (role === 'reviewer' || role === 'admin') &&
  typeof actorId === 'string' && actorId.length > 0 && actorId !== reportAuthorId;
export function validateManualReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (JSON.stringify(body).length > 4000) return null;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!MANUAL_CATEGORIES.includes(body.category) ||
      title.length < 5 || title.length > 160 ||
      description.length < 10 || description.length > 3000) return null;
  return {category: body.category, title, description};
}
