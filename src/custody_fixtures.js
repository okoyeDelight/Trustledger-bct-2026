/**
 * Additional synthetic example records, NOT supplied by organizer.
 * Shows what a real system would require to associate equipment exposure
 * to specific units. Never treat this as verified facility inventory history.
 * Times are East Africa Time; no clinical exposure or compatibility is proved.
 */
export const CUSTODY_FIXTURES = Object.freeze([
  { caseId: "TL-024", unitId: "DEMO-RBC-024-A", facilityId: "HSP-024",
    deviceId: "ILLUSTRATIVE-FR-A", enteredAt: "2026-09-30T06:00:00+03:00",
    leftAt: "2026-10-02T20:00:00+03:00", source: "ADDED_SYNTHETIC_CUSTODY_FIXTURE" },
  { caseId: "TL-024", unitId: "DEMO-RBC-024-B", facilityId: "HSP-024",
    deviceId: "ILLUSTRATIVE-FR-A", enteredAt: "2026-10-01T09:00:00+03:00",
    leftAt: "2026-10-02T18:00:00+03:00", source: "ADDED_SYNTHETIC_CUSTODY_FIXTURE" },
  { caseId: "TL-NBO-HOT", unitId: "DEMO-RBC-NBO-H1", facilityId: "RBTC-NBO",
    deviceId: "ILLUSTRATIVE-FR-B", enteredAt: "2026-10-05T22:00:00+03:00",
    leftAt: "2026-10-06T04:00:00+03:00", source: "ADDED_SYNTHETIC_CUSTODY_FIXTURE" },
  { caseId: "TL-NBO-GLITCH", unitId: "DEMO-RBC-NBO-G1", facilityId: "RBTC-NBO",
    deviceId: "ILLUSTRATIVE-FR-C", enteredAt: "2026-03-27T05:00:00+03:00",
    leftAt: "2026-03-27T12:00:00+03:00", source: "ADDED_SYNTHETIC_CUSTODY_FIXTURE" },
  { caseId: "TL-024-CONTROL", unitId: "DEMO-RBC-024-C1", facilityId: "HSP-024",
    deviceId: "ILLUSTRATIVE-FR-D", enteredAt: "2026-10-02T18:00:00+03:00",
    leftAt: "2026-10-02T23:00:00+03:00", source: "ADDED_SYNTHETIC_CUSTODY_FIXTURE" },
]);

export function candidateCustody(caseId, start, end) {
  const startMs = Date.parse(start), endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs)
    throw new Error("Invalid incident evidence interval");
  return CUSTODY_FIXTURES.filter(r => r.caseId === caseId)
    .filter(r => Date.parse(r.enteredAt) <= endMs && Date.parse(r.leftAt) >= startMs)
    .map(r => ({ ...r, relation: "ILLUSTRATIVE_TIME_OVERLAP_NOT_VERIFIED_EXPOSURE" }));
}
