/**
 * TrustLedger evidence engine.
 * Hackathon demo only. All facility temperatures below are copied from the
 * organizer-provided SYNTHETIC starter temperature_logs.csv. The DEMO-* units,
 * fridge links, workflows and reference labels are SUPPLEMENTAL SYNTHETIC
 * FIXTURES, not location history supplied by the organizer.
 *
 * In particular, original temperature readings are FACILITY LEVEL. We cannot
 * establish a real blood unit's actual fridge exposure from those readings.
 */
export const POLICY = Object.freeze({
  component: "RBC",
  minC: 2,
  maxC: 6,
  maxReasonableC: 25,
  minReasonableC: -10,
  expectedIntervalHours: 1,
  description: "Illustrative RBC demo band (2–6°C); NOT a validated facility SOP",
});

function reading(at, c) { return { at: at.replace(" ", "T") + "+03:00", c, source: "starter:temperature_logs.csv" }; }

export const SCENARIOS = Object.freeze([
  {
    id: "TL-024",
    title: "The 57-hour blind spot",
    subtitle: "Normal readings conceal missing evidence",
    facility: "HSP-024",
    component: "RBC",
    siteLabel: "HSP-024 · illustrative fridge FR-A",
    period: "30 Sep – 2 Oct 2026",
    evidenceScope: "Source readings identify a facility, NOT a named refrigerator.",
    fixtureScope: "FR-A and DEMO units are synthetic mappings added for this prototype.",
    annotatedReviewNeeded: true,
    units: ["DEMO-RBC-024-A", "DEMO-RBC-024-B"],
    readings: [
      reading("2026-09-30 07:00:00", 3.9),
      reading("2026-09-30 08:00:00", 4.3),
      reading("2026-09-30 09:00:00", 3.9),
      reading("2026-10-02 19:00:00", 4.3),
      reading("2026-10-02 20:00:00", 4.2),
      reading("2026-10-02 21:00:00", 4.2),
    ],
  },
  {
    id: "TL-NBO-HOT",
    title: "Recorded temperature excursion",
    subtitle: "An observed range breach, not proof of unit damage",
    facility: "RBTC-NBO",
    component: "RBC",
    siteLabel: "RBTC-NBO · illustrative fridge FR-B",
    period: "5–6 Oct 2026",
    evidenceScope: "Temperature values from facility feed; no physical device ID.",
    fixtureScope: "FR-B and DEMO unit are supplemental synthetic assignments.",
    annotatedReviewNeeded: true,
    units: ["DEMO-RBC-NBO-H1"],
    readings: [
      reading("2026-10-05 23:00:00", 5.9),
      reading("2026-10-06 00:00:00", 7.0),
      reading("2026-10-06 01:00:00", 7.9),
      reading("2026-10-06 02:00:00", 6.2),
      reading("2026-10-06 03:00:00", 5.4),
    ],
  },
  {
    id: "TL-NBO-GLITCH",
    title: "The impossible reading",
    subtitle: "Preserve the 99.9°C raw record; don't invent certainty",
    facility: "RBTC-NBO",
    component: "RBC",
    siteLabel: "RBTC-NBO · illustrative fridge FR-C",
    period: "27 Mar 2026",
    evidenceScope: "Facility temperature feed contains an extreme outlier.",
    fixtureScope: "FR-C and DEMO unit are supplemental synthetic assignments.",
    annotatedReviewNeeded: true,
    units: ["DEMO-RBC-NBO-G1"],
    readings: [
      reading("2026-03-27 06:00:00", 3.9),
      reading("2026-03-27 07:00:00", 3.8),
      reading("2026-03-27 08:00:00", 99.9),
      reading("2026-03-27 09:00:00", 3.9),
      reading("2026-03-27 10:00:00", 3.7),
      reading("2026-03-27 11:00:00", 3.9),
    ],
  },
  {
    id: "TL-024-CONTROL",
    title: "Clean monitoring window",
    subtitle: "A negative control, subject to reviewer sign-off",
    facility: "HSP-024",
    component: "RBC",
    siteLabel: "HSP-024 · illustrative fridge FR-D",
    period: "2 Oct 2026",
    evidenceScope: "Only these four consecutive facility-level readings were evaluated.",
    fixtureScope: "FR-D and DEMO unit are supplemental synthetic assignments.",
    annotatedReviewNeeded: false,
    units: ["DEMO-RBC-024-C1"],
    readings: [
      reading("2026-10-02 19:00:00", 4.3),
      reading("2026-10-02 20:00:00", 4.2),
      reading("2026-10-02 21:00:00", 4.2),
      reading("2026-10-02 22:00:00", 4.3),
    ],
  },
]);

export function inspectEvidence(input, policy = POLICY) {
  if (!Array.isArray(input) || !input.length) {
    return { kind: "missing", flags: [{ kind: "missing", detail: "No measurements supplied" }], gapHours: 0,
      min: null, max: null, latest: null, count: 0, certainty: "UNKNOWN", needsReview: true };
  }
  const readings = input.map(r => ({ ...r, ms: new Date(r.at).getTime(), value: Number(r.c) }))
    .sort((a, b) => a.ms - b.ms);
  const flags = [];
  let gapHours = 0;
  let observed = 0;
  const plausible = [];
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    if (!Number.isFinite(r.ms) || !Number.isFinite(r.value)) {
      flags.push({ kind: "invalid", detail: "Unparseable timestamp or temperature", at: r.at }); continue;
    }
    if (i > 0) {
      const h = (r.ms - readings[i - 1].ms) / 3600000;
      if (h > policy.expectedIntervalHours + 0.01) {
        const missing = Math.max(0, Math.round(h / policy.expectedIntervalHours) - 1);
        gapHours += missing;
        flags.push({ kind: "gap", detail: missing + " expected hourly readings missing", at: readings[i - 1].at,
          endAt: r.at, missing });
      }
      if (h < 0.99) flags.push({ kind: "duplicate", detail: "Unexpected or duplicate timestamps", at: r.at });
    }
    if (r.value < policy.minReasonableC || r.value > policy.maxReasonableC) {
      flags.push({ kind: "implausible", detail: "Raw " + r.value + "°C is outside the sanity band; verify sensor", at: r.at, value: r.value });
    } else {
      plausible.push(r.value);
      if (r.value < policy.minC || r.value > policy.maxC) {
        observed++;
        flags.push({ kind: "excursion", detail: "Observed " + r.value + "°C outside illustrative " + policy.minC + "–" + policy.maxC + "°C band", at: r.at, value: r.value });
      }
    }
  }
  const kinds = new Set(flags.map(f => f.kind));
  const kind = kinds.has("excursion") ? "excursion" : kinds.has("gap") ? "gap"
    : kinds.has("implausible") || kinds.has("invalid") || kinds.has("duplicate") ? "implausible" : "clear";
  const certainty = kinds.has("gap") || kinds.has("implausible") || kinds.has("invalid") ? "INCOMPLETE"
    : kinds.has("excursion") ? "OBSERVED EXCURSION" : "NO FLAG IN WINDOW";
  return { kind, flags, gapHours, min: plausible.length ? Math.min(...plausible) : null,
    max: plausible.length ? Math.max(...plausible) : null, latest: readings.at(-1).value,
    count: readings.length, observed, certainty, needsReview: flags.length > 0 };
}

export function latestOnlyBaseline(input, policy = POLICY) {
  if (!input?.length) return true;
  const last = input.reduce((a, b) => Date.parse(a.at) >= Date.parse(b.at) ? a : b);
  const n = Number(last.c);
  return !Number.isFinite(n) || n < policy.minC || n > policy.maxC;
}

export function competentRulesBaseline(input, policy = POLICY) {
  return inspectEvidence(input, policy).needsReview;
}

export function benchmark() {
  const rows = SCENARIOS.map(s => {
    const truth = s.annotatedReviewNeeded;
    const latest = latestOnlyBaseline(s.readings);
    const strong = competentRulesBaseline(s.readings);
    const feature = inspectEvidence(s.readings).needsReview;
    return { id: s.id, title: s.title, truth, latest, strong, feature };
  });
  function counts(key) {
    const tp = rows.filter(r => r.truth && r[key]).length;
    const tn = rows.filter(r => !r.truth && !r[key]).length;
    const fp = rows.filter(r => !r.truth && r[key]).length;
    const fn = rows.filter(r => r.truth && !r[key]).length;
    return { tp, tn, fp, fn, correct: tp + tn, total: rows.length,
      sensitivity: tp / Math.max(1, rows.filter(r => r.truth).length) };
  }
  return { rows, latest: counts("latest"), strong: counts("strong"), feature: counts("feature"),
    caveat: "Four deliberately selected, manually annotated demo windows; not an independent clinical validation. The evidence feature matches a competent rules baseline here; there is no demonstrated advantage over it." };
}

export const STORE_VERSION = 1;
export function freshState() {
  return { version: STORE_VERSION, cases: Object.fromEntries(SCENARIOS.map(s => [s.id,
    { proposal: null, reason: "", reviewerDecision: null, reviewerNote: "", disposition: "unresolved" }])),
    audit: [], issueAttempts: [], mode: "rules" };
}

function snapshot(state) { return JSON.parse(JSON.stringify(state)); }
function stamp(actor, action, caseId, detail) {
  return { id: (globalThis.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random()), at: new Date().toISOString(),
    actor, action, caseId, detail };
}
export function propose(state, caseId, proposal, reason) {
  const s = SCENARIOS.find(c => c.id === caseId);
  if (!s) throw new Error("Unknown case");
  if (!["hold", "investigate", "clear_mock"].includes(proposal)) throw new Error("Invalid proposed action");
  if (proposal === "clear_mock" && inspectEvidence(s.readings).needsReview)
    throw new Error("Cannot propose a clear demonstration for unresolved or abnormal evidence");
  if ((reason || "").trim().length < 8) throw new Error("Operator rationale must be at least 8 characters");
  const next = snapshot(state);
  next.cases[caseId] = { proposal, reason: reason.trim(), reviewerDecision: null, reviewerNote: "", disposition: "awaiting_reviewer" };
  next.audit.unshift(stamp("Operator (simulated)", "PROPOSAL", caseId, proposal + " · " + reason.trim()));
  return next;
}
export function review(state, caseId, decision, note) {
  const s = SCENARIOS.find(c => c.id === caseId), c = state.cases[caseId];
  if (!s || !c?.proposal) throw new Error("An operator proposal is required first");
  if (!["accept", "change", "reject"].includes(decision)) throw new Error("Invalid reviewer decision");
  if ((note || "").trim().length < 8) throw new Error("Reviewer rationale must be at least 8 characters");
  const evidence = inspectEvidence(s.readings);
  if (c.proposal === "clear_mock" && evidence.needsReview) throw new Error("Clear mock action not allowed with evidence flags");
  const next = snapshot(state);
  const disposition = decision === "reject" ? "returned_to_operator"
    : decision === "change" ? "authorized_hold"
    : c.proposal === "clear_mock" ? "mock_clear" : c.proposal === "hold" ? "authorized_hold" : "authorized_investigation";
  next.cases[caseId] = { ...c, reviewerDecision: decision, reviewerNote: note.trim(), disposition };
  next.audit.unshift(stamp("Quality reviewer (simulated)", decision.toUpperCase(), caseId, disposition + " · " + note.trim()));
  return next;
}
export function issueGuard(state, caseId, unitId) {
  const s = SCENARIOS.find(c => c.id === caseId);
  if (!s || !s.units.includes(unitId)) throw new Error("Unit not in this synthetic case mapping");
  const c = state.cases[caseId];
  const evidence = inspectEvidence(s.readings);
  const allowed = !evidence.needsReview && c?.disposition === "mock_clear";
  const reason = allowed ? "Simulated issue permitted for clean demo window after mock reviewer sign-off; NOT clinical release"
    : evidence.needsReview ? "STOP: evidence is incomplete or abnormal; mock issue cannot proceed"
    : "STOP: mock reviewer clearance is still required";
  const next = snapshot(state);
  next.issueAttempts.unshift({ caseId, unitId, at: new Date().toISOString(), allowed, reason });
  next.audit.unshift(stamp("Issue desk (simulated)", allowed ? "MOCK_ISSUE_ALLOWED" : "MOCK_ISSUE_BLOCKED", caseId, unitId + " · " + reason));
  return { state: next, allowed, reason };
}
export function ensureState(value) {
  if (!value || value.version !== STORE_VERSION || !value.cases || !SCENARIOS.every(c => value.cases[c.id]))
    return freshState();
  return value;
}
