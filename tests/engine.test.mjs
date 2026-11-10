import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENARIOS, POLICY, inspectEvidence, latestOnlyBaseline, competentRulesBaseline,
  benchmark, freshState, propose, review, closeReview, issueGuard, ensureState
} from "../src/engine.js";
import { EVIDENCE_CASES } from "../src/source_evidence.js";

const scenario = id => SCENARIOS.find(s => s.id === id);

test("57 missing hourly points between 09:00 30 Sep and 19:00 2 Oct", () => {
  const inspection = inspectEvidence(scenario("TL-024").readings);
  assert.equal(inspection.gapHours, 57);
  assert.equal(inspection.kind, "gap");
  assert.equal(inspection.latest, 4.2);
  assert.equal(inspection.certainty, "INCOMPLETE");
  assert.equal(inspection.needsReview, true);
  assert.equal(latestOnlyBaseline(scenario("TL-024").readings), false,
    "Latest-value-only alert misses the gap");
  assert.equal(competentRulesBaseline(scenario("TL-024").readings), true);
});

test("actual facility-level excursion is observed without concluding named-unit exposure", () => {
  const inspection = inspectEvidence(scenario("TL-NBO-HOT").readings);
  assert.equal(inspection.kind, "excursion");
  assert.equal(inspection.max, 7.9);
  assert.equal(inspection.observed, 3);
  assert.equal(inspection.latest, 5.4);
  assert.equal(latestOnlyBaseline(scenario("TL-NBO-HOT").readings), false);
  assert.match(scenario("TL-NBO-HOT").fixtureScope, /supplemental synthetic/);
});

test("99.9°C glitch is preserved but excluded from plausible max", () => {
  const inspection = inspectEvidence(scenario("TL-NBO-GLITCH").readings);
  assert.equal(inspection.kind, "implausible");
  assert.equal(inspection.max, 3.9);
  assert.ok(inspection.flags.some(flag => flag.value === 99.9));
  assert.ok(scenario("TL-NBO-GLITCH").readings.some(r => r.c === 99.9));
});

test("four-window honest comparison has baseline miss and parity with competent rules", () => {
  const b = benchmark();
  assert.equal(b.rows.length, 4);
  assert.equal(b.latest.correct, 1);
  assert.equal(b.latest.fn, 3);
  assert.equal(b.strong.correct, 4);
  assert.equal(b.feature.correct, 4);
  assert.equal(b.strong.sensitivity, b.feature.sensitivity);
  assert.match(b.caveat, /no demonstrated advantage/i);
});

test("issue blocked for unresolved 57-hour gap, and audit captured", () => {
  const result = issueGuard(freshState(), "TL-024", "DEMO-RBC-024-A");
  assert.equal(result.allowed, false);
  assert.equal(result.state.audit[0].action, "MOCK_ISSUE_BLOCKED");
  assert.equal(result.state.issueAttempts.length, 1);
});

test("operator can propose, quality reviewer accepts hold, mock issue still blocked", () => {
  let state = freshState();
  state = propose(state, "TL-024", "hold", "57 hours without observation require review");
  assert.equal(state.cases["TL-024"].disposition, "awaiting_reviewer");
  state = review(state, "TL-024", "accept", "Quarantine in demo until records are verified");
  assert.equal(state.cases["TL-024"].disposition, "authorized_hold");
  const attempt = issueGuard(state, "TL-024", "DEMO-RBC-024-B");
  assert.equal(attempt.allowed, false);
  assert.equal(attempt.state.audit.length, 3);
});

test("reviewer can change or reject while guard stays blocked", () => {
  let state = propose(freshState(), "TL-024", "investigate", "Need to reconstruct the 57 missing hours");
  assert.equal(review(state, "TL-024", "change", "Change to precautionary hold while investigating")
    .cases["TL-024"].disposition, "authorized_hold");
  assert.equal(review(state, "TL-024", "reject", "No documented location link, return for correction")
    .cases["TL-024"].disposition, "returned_to_operator");
});

test("clean control requires separate sign-off before permitting a *mock* issue", () => {
  let state = freshState();
  assert.equal(inspectEvidence(scenario("TL-024-CONTROL").readings).needsReview, false);
  assert.equal(issueGuard(state, "TL-024-CONTROL", "DEMO-RBC-024-C1").allowed, false);
  state = propose(state, "TL-024-CONTROL", "clear_mock", "No flagged sample in this limited demo window");
  state = review(state, "TL-024-CONTROL", "accept", "Mock desk approval for test flow only, not clinical use");
  assert.equal(state.cases["TL-024-CONTROL"].disposition, "mock_clear");
  assert.equal(issueGuard(state, "TL-024-CONTROL", "DEMO-RBC-024-C1").allowed, true);
});

test("abnormal evidence can never be mock-cleared through operator proposal", () => {
  assert.throws(() => propose(freshState(), "TL-024", "clear_mock", "Please clear despite missing data"),
    /Cannot propose a clear/);
});

test("role steps require text justifications and known unit associations", () => {
  assert.throws(() => propose(freshState(), "TL-024", "hold", ""), /rationale/);
  assert.throws(() => review(freshState(), "TL-024", "accept", "Sufficient reason"), /operator proposal/i);
  assert.throws(() => issueGuard(freshState(), "TL-024", "UNKNOWN-UNIT"), /not in this synthetic/);
  assert.equal(ensureState({ version: -2 }).version, 1);
});


test("documented zero-C sentinel is an untrusted reading, not proof of a measured excursion", () => {
  const evidence = inspectEvidence([
    { at: "2026-01-01T10:00:00+03:00", c: 4.1 },
    { at: "2026-01-01T11:00:00+03:00", c: 0.0 },
    { at: "2026-01-01T12:00:00+03:00", c: 4.3 }
  ]);
  assert.equal(evidence.kind, "implausible");
  assert.equal(evidence.observed, 0);
  assert.equal(evidence.needsReview, true);
  assert.equal(evidence.min, 4.1);
  assert.equal(evidence.flags.some(f => f.kind === "implausible" && f.value === 0), true);
});


test("source-linked outage and measured excursion are shown without fabricated unit mapping", () => {
  const hot = scenario("TL-NBO-HOT");
  assert.equal(hot.readings.length, 5);
  assert.equal(hot.powerOutages.length, 1);
  assert.equal(hot.powerOutages[0].outage_id, "OUT-00009");
  assert.equal(hot.powerOutages[0].backup_power_engaged, false);
  assert.equal(hot.powerOutages[0].duration_hours, 3.83);
  assert.equal(inspectEvidence(hot.readings).max, 7.9);
  assert.equal(hot.confirmedDeviceUnitHistory, false);
  assert.match(EVIDENCE_CASES["TL-NBO-HOT"].exposure_provenance, /NO named fridge-to-unit/);
  const gap = scenario("TL-024");
  assert.equal(gap.powerOutages.length, 0);
  assert.equal(inspectEvidence(gap.readings).gapHours, 57);
  assert.ok(SCENARIOS.every(s => s.readings.every(r => r.source === "starter:temperature_logs.csv")));
});

test("source-backed values are not hardcoded as guessed temperature data", () => {
  for (const sc of SCENARIOS) {
    assert.deepEqual(sc.readings, EVIDENCE_CASES[sc.id].source_readings);
    assert.equal(sc.facility, EVIDENCE_CASES[sc.id].facility_id);
  }
});

test("qualified simulated review may close paperwork without silently clearing evidence or mock issue", () => {
  let s = freshState();
  assert.throws(() => closeReview(s, "TL-NBO-HOT", "continued_hold",
    "Check site logs before any release"), /reviewer must authorize/i);
  s = propose(s, "TL-NBO-HOT", "investigate", "Investigate power outage and recorded 7.9C source reading");
  s = review(s, "TL-NBO-HOT", "accept", "Refer to the responsible person for site-specific SOP");
  s = closeReview(s, "TL-NBO-HOT", "refer_site_authority",
    "Power outage OUT-00009 overlaps observed 7.9C; named equipment and unit linkage are unknown.");
  assert.equal(s.cases["TL-NBO-HOT"].disposition, "referred_site_authority");
  assert.equal(s.audit[0].action, "REVIEW_CLOSED_NO_RELEASE");
  assert.equal(issueGuard(s, "TL-NBO-HOT", "DEMO-RBC-NBO-H1").allowed, false);
  assert.throws(() => closeReview(s, "TL-NBO-HOT", "continued_hold",
    "Try documenting same case twice after closure"), /reviewer must authorize/i);
});
