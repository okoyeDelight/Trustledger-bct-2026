import { SCENARIOS, inspectEvidence, freshState, ensureState, propose, review, closeReview, issueGuard } from "../src/engine.js";

const KEY = "trustledger-one-source-pilot-v1";
const CASE_ID = "TL-024";
const SOURCE = SCENARIOS.find(s => s.id === CASE_ID);
const EVIDENCE = inspectEvidence(SOURCE.readings);
const GAP = EVIDENCE.flags.find(f => f.kind === "gap");
const FIRST = SOURCE.readings.find(r => r.at === GAP?.at);
const LAST = SOURCE.readings.find(r => r.at === GAP?.endAt);
const ISSUE_UNIT = SOURCE.units[0];
const app = document.getElementById("app");
const status = document.getElementById("announcement");
const cased = () => state.cases[CASE_ID];

function readSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return { state: ensureState(raw?.state), view: raw?.view === "read" || raw?.view === "investigate" ? raw.view : "queue" };
  } catch (_) { return { state: freshState(), view: "queue" }; }
}
let { state, view } = readSaved();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ state, view })); }
  catch (_) { announce("Browser storage unavailable. Work will remain only in this tab.", true); }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function formatTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Nairobi", hour12: false
  }).format(new Date(iso)) + " EAT";
}
function announce(message, error = false) {
  status.textContent = message;
  status.hidden = false;
  status.className = "toast" + (error ? " error" : "");
}
function currentScreen() {
  if (view === "queue") return "queue";
  if (cased().closureOutcome) return "done";
  const disposition = cased().disposition;
  if (disposition === "awaiting_reviewer") return "review";
  if (disposition === "authorized_hold" || disposition === "authorized_investigation") return "followup";
  if (disposition === "returned_to_operator") return "investigate";
  return view;
}

function statusName() {
  const d = cased().disposition;
  return ({
    unresolved: "Needs investigation",
    awaiting_reviewer: "Awaiting review",
    returned_to_operator: "Needs more information",
    authorized_investigation: "Follow-up required",
    authorized_hold: "Hold recorded",
    review_documented_hold: "Review documented",
    referred_site_authority: "Referred to site authority"
  })[d] || "Needs investigation";
}
function shell(title, kicker, description, body, step = 0) {
  document.getElementById("breadcrumb-current").textContent = step === 0 ? "INCIDENTS" : "INCIDENT TL-024";
  const header = '<header class="page-heading"><div class="eyebrow">' + escapeHtml(kicker) +
    '</div><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(description) + '</p></header>';
  const progress = step > 0
    ? '<nav class="progress" aria-label="Incident progress">' +
      ["Understand", "Investigate", "Review", "Follow up"].map((t, i) =>
      '<span class="progress-step ' + (i + 1 < step ? "done" : i + 1 === step ? "active" : "") +
      '"><span class="progress-num">' + (i + 1) + '</span>' + t + '</span>').join("") + '</nav>'
    : "";
  app.innerHTML = header + progress + body;
}

function topStrip() {
  return '<div class="case-meta"><span>CASE TL-024</span><span>FACILITY HSP-024</span><span>ORGANIZER SYNTHETIC DATA</span></div>';
}
function queue() {
  shell("Incidents", "WORKSPACE / ONE MONITORING SOURCE",
    "One monitoring problem needs attention. Open it to see what happened and what to do next.",
    '<div class="queue-wrap"><div class="queue-top"><div><div class="section-label">YOUR MONITORING SOURCE</div>' +
    '<h2>HSP-024 <span class="muted">· facility temperature feed</span></h2>' +
    '<p>One source loaded from the organizer’s dataset. No live reader connection.</p></div>' +
    '<span class="count">01 incident</span></div>' +
    '<section class="incident-row" aria-label="Missing temperature records">' +
    '<div class="incident-id"><span class="amber-point"></span> NEEDS ATTENTION <span class="thin-divider">/</span> TL-024</div>' +
    '<h3>Temperature records missing</h3>' +
    '<p>' + EVIDENCE.gapHours + ' expected hourly measurements are absent. The latest reading is ' +
    EVIDENCE.latest.toFixed(1) + '°C, but the missing interval is unknown.</p>' +
    '<div class="incident-footer"><span>30 Sep – 2 Oct 2026 <span class="sep-dot">·</span> ' +
    escapeHtml(statusName()) + '</span><button type="button" class="primary" data-open>Open incident <span aria-hidden="true">→</span></button></div></section></div>' +
    '<p class="quiet-line">This pilot intentionally contains one source-backed incident. Staff accounts and live feeds are not connected.</p>');
}
function evidenceTimeline() {
  const left = FIRST ? escapeHtml(FIRST.c.toFixed(1)) : "?";
  const right = LAST ? escapeHtml(LAST.c.toFixed(1)) : "?";
  return '<section class="evidence-window" aria-label="Original temperature observations and missing interval">' +
    '<div class="plot-label">WHAT WE KNOW FROM THE SOURCE RECORDS</div>' +
    '<div class="timeline">' +
    '<div class="reading"><div class="reading-value">' + left + '<small>°C</small></div><span>' +
    escapeHtml(formatTime(GAP.at)) + '</span></div>' +
    '<div class="unobserved"><span>NO MEASUREMENTS</span><strong>' + EVIDENCE.gapHours +
    ' missing</strong><span>expected hourly readings</span></div>' +
    '<div class="reading"><div class="reading-value">' + right + '<small>°C</small></div><span>' +
    escapeHtml(formatTime(GAP.endAt)) + '</span></div></div>' +
    '<div class="plot-caption">The blank interval is intentional. No temperatures have been estimated or filled in.</div></section>';
}
function evidence() {
  return topStrip() +
    '<div class="incident-paper">' +
    '<div class="headline-row"><span class="risk-label"><span class="amber-point"></span> Monitoring interruption</span><span class="case-state">' + escapeHtml(statusName()) + '</span></div>' +
    '<h2>57 hours of readings are missing.</h2>' +
    '<p class="lead">The last recorded temperature is ' + EVIDENCE.latest.toFixed(1) +
    '°C. That looks normal, but it tells us nothing about the missing hours.</p>' +
    evidenceTimeline() +
    '<div class="meaning"><strong>What this means</strong><p>We need to investigate the monitoring interruption. These facility-level readings do not identify a particular refrigerator or establish the condition of any blood unit.</p></div>' +
    '<div class="bottom-actions"><button class="secondary" type="button" data-back="queue">Back to incidents</button>' +
    '<button class="primary" type="button" data-investigate>Start investigation <span aria-hidden="true">→</span></button></div>' +
    '</div>';
}
function readScreen() {
  shell("Understand the problem", "INCIDENT TL-024 / STEP 1", "Review the available measurements before recording what you know.", evidence(), 1);
}
function history() {
  const events = state.audit.filter(a => a.caseId === CASE_ID);
  if (!events.length) return "";
  return '<details class="activity"><summary>Case activity (' + events.length + ' events)</summary><ol>' +
    events.map(a => '<li><strong>' + escapeHtml(a.action.replaceAll("_", " ")) +
    '</strong><span>' + escapeHtml(formatTime(a.at)) + ' · ' + escapeHtml(a.actor) +
    '</span><p>' + escapeHtml(a.detail) + '</p></li>').join("") + '</ol></details>';
}
function investigationScreen() {
  const returned = cased().disposition === "returned_to_operator";
  const previousReason = cased().reason || "";
  shell("Record your findings", "INCIDENT TL-024 / STEP 2",
    "Write down what the available evidence tells you, and what still needs checking.",
    topStrip() + '<div class="stage-grid"><section class="work-card">' +
    (returned ? '<div class="return-note"><strong>Reviewer requested changes</strong><p>' + escapeHtml(cased().reviewerNote) + '</p></div>' : "") +
    '<div class="section-label">INVESTIGATION</div><h2>What have you established?</h2>' +
    '<p class="field-intro">The original readings show ' + EVIDENCE.gapHours +
    ' missing hourly records. Don’t guess what the temperatures were or claim a specific unit was affected.</p>' +
    '<form id="investigate-form"><label for="check-result">Status of supporting evidence</label>' +
    '<select id="check-result" required><option value="">Select what you can document</option>' +
    '<option value="Only source temperature records are available">Only temperature records available</option>' +
    '<option value="Additional equipment records need to be requested">Need to request equipment records</option>' +
    '<option value="Equipment records were reviewed, as described in findings">Equipment records checked (describe below)</option></select>' +
    '<label for="finding-text">Your findings <span class="required">*</span></label>' +
    '<textarea id="finding-text" required minlength="12" rows="5" placeholder="e.g. The logger did not provide hourly records for 57 hours. No evidence currently verifies conditions during the gap."></textarea>' +
    '<div class="hint">Use factual observations. Explain what remains unknown.</div>' +
    '<label for="proposed-action">Recommended next step</label><select id="proposed-action">' +
    '<option value="investigate">Request more evidence / continue investigation</option>' +
    '<option value="hold">Recommend precautionary hold for review</option></select>' +
    '<div class="bottom-actions"><button class="secondary" type="button" data-back="read">Back</button>' +
    '<button class="primary" type="submit">Submit for review <span aria-hidden="true">→</span></button></div></form></section>' +
    '<aside class="helper-card"><div class="section-label">EVIDENCE AT A GLANCE</div>' +
    '<div class="helper-metric">' + EVIDENCE.gapHours + ' <small>missing hourly records</small></div>' +
    '<div class="helper-line">Last reading <strong>' + EVIDENCE.latest.toFixed(1) + '°C</strong></div>' +
    '<div class="helper-line">Source <strong>Facility-level</strong></div>' +
    '<div class="helper-line">Unit exposure <strong>Not verified</strong></div>' +
    '<p>Submitting sends a simulated proposal to the next review stage. It does not change real inventory.</p></aside></div>' +
    history(), 2);
  if (previousReason && returned) document.getElementById("finding-text").value = previousReason.replace(/^Source review: .*?\. Findings: /, "");
}
function reviewerScreen() {
  shell("Review the investigation", "INCIDENT TL-024 / STEP 3",
    "A second decision is required in this demonstration. This is a simulated reviewer, not an authenticated staff account.",
    topStrip() + '<div class="stage-grid"><section class="work-card"><div class="section-label">AWAITING QUALITY REVIEW</div>' +
    '<h2>Investigation submitted</h2>' +
    '<div class="submitted-box"><span>Operator recommendation</span><strong>' +
    (cased().proposal === "hold" ? "Precautionary hold for review" : "Continue investigation / request evidence") +
    '</strong><p>' + escapeHtml(cased().reason) + '</p></div>' +
    '<form id="review-form"><label for="review-note">Reviewer decision notes</label>' +
    '<textarea id="review-note" required minlength="8" rows="4" placeholder="Explain why the recommendation is accepted, changed or returned."></textarea>' +
    '<p class="hint">No review action can clinically release a blood unit.</p>' +
    '<div class="review-actions"><button class="primary" type="submit" data-decision="accept">Accept recommendation</button>' +
    '<button class="secondary" type="submit" data-decision="change">Change to hold</button>' +
    '<button class="plain-link" type="submit" data-decision="reject">Return for more information</button></div>' +
    '</form></section><aside class="helper-card"><div class="section-label">REVIEW CHECKLIST</div>' +
    '<p class="checkline">✓ Available measurements identified</p>' +
    '<p class="checkline">✓ Unobserved time left unknown</p>' +
    '<p class="checkline">○ Equipment/unit traceability not established</p>' +
    '<p>Role labels are simulated in the same browser. Real authorization requires a facility procedure and staff login.</p></aside></div>' +
    history(), 3);
}
function followupScreen() {
  shell("Record the next action", "INCIDENT TL-024 / STEP 4",
    "The reviewer has made a simulated decision. Document what happens next without assuming the evidence is complete.",
    topStrip() + '<div class="stage-grid"><section class="work-card"><div class="section-label">REVIEW DECISION RECORDED</div>' +
    '<h2>' + (cased().disposition === "authorized_hold" ? "Hold authorized in the demo" : "Further investigation authorized") + '</h2>' +
    '<div class="submitted-box"><span>Reviewer notes</span><p>' + escapeHtml(cased().reviewerNote) +
    '</p></div><form id="followup-form"><label for="resolution">Administrative outcome</label>' +
    '<select id="resolution"><option value="refer_site_authority">Refer to site authority for next decision</option>' +
    '<option value="continued_hold">Document review; restriction continues</option></select>' +
    '<label for="closure-note">Evidence still needed and next action</label>' +
    '<textarea id="closure-note" rows="4" minlength="18" required placeholder="e.g. Request equipment history and unit-location records. No clinical release has been authorized."></textarea>' +
    '<div class="hint">Closing this paperwork does not prove safe storage conditions.</div>' +
    '<div class="bottom-actions"><button class="primary" type="submit">Record outcome <span aria-hidden="true">→</span></button></div>' +
    '</form></section><aside class="helper-card"><div class="section-label">STILL UNKNOWN</div>' +
    '<p>The missing temperatures, equipment identity and unit exposure remain unverified. A qualified site process is required for any clinical decision.</p></aside></div>' +
    history(), 4);
}
function doneScreen() {
  const referral = cased().closureOutcome === "refer_site_authority";
  const latestAttempt = state.issueAttempts.find(a => a.caseId === CASE_ID);
  shell("Investigation recorded", "INCIDENT TL-024 / DOCUMENTED OUTCOME",
    "The review record is complete for this demonstration. The underlying missing readings have not been resolved.",
    topStrip() + '<section class="final-card"><div class="final-check" aria-hidden="true">✓</div>' +
    '<div><div class="section-label">ADMINISTRATIVE RECORD COMPLETED</div><h2>' +
    (referral ? "Referred to site authority" : "Review documented; hold continues") +
    '</h2><p>' + escapeHtml(cased().closureNote) + '</p></div></section>' +
    '<div class="final-warning"><strong>Restriction still applies</strong>' +
    '<p>There is no confirmed unit-to-fridge history and the temperature gap is unresolved. Recording an outcome does not permit real blood release.</p></div>' +
    '<section class="verification-card"><div><div class="section-label">SOFTWARE CHECK</div>' +
    '<h3>Test the simulated issuing restriction</h3><p>Use a <strong>fictional</strong> demo unit to verify that an unresolved case is blocked.</p></div>' +
    '<button type="button" class="secondary" data-test-guard>Test mock issue restriction</button></section>' +
    (latestAttempt ? '<p class="guard-result ' + (latestAttempt.allowed ? "good" : "blocked") + '">' +
    (latestAttempt.allowed ? "Mock issue allowed (demo only)" : "MOCK ISSUE BLOCKED") +
    ' — ' + escapeHtml(latestAttempt.reason) + '</p>' : "") +
    history() +
    '<div class="bottom-actions"><button class="primary" data-home type="button">Return to incidents <span aria-hidden="true">→</span></button></div>', 4);
}
function render() {
  const page = currentScreen();
  if (page === "queue") queue();
  else if (page === "read") readScreen();
  else if (page === "investigate") investigationScreen();
  else if (page === "review") reviewerScreen();
  else if (page === "followup") followupScreen();
  else doneScreen();
}
function goto(page) {
  view = page;
  save();
  render();
  window.scrollTo(0, 0);
}
document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  try {
    if (button.matches("[data-open]")) goto("read");
    else if (button.matches("[data-investigate]")) goto("investigate");
    else if (button.matches("[data-back]")) goto(button.dataset.back);
    else if (button.matches("[data-home]")) goto("queue");
    else if (button.matches("[data-test-guard]")) {
      const result = issueGuard(state, CASE_ID, ISSUE_UNIT);
      state = result.state; save(); render();
      announce(result.allowed ? "Mock issue permitted for a clean demo only." : "MOCK ISSUE BLOCKED — evidence remains unresolved.");
    }
  } catch (err) { announce(err.message, true); }
});
document.addEventListener("submit", event => {
  if (!["investigate-form","review-form","followup-form"].includes(event.target?.id)) return;
  event.preventDefault();
  try {
    const form = event.target;
    if (form.id === "investigate-form") {
      const checked = document.getElementById("check-result").value;
      const finding = document.getElementById("finding-text").value.trim();
      const action = document.getElementById("proposed-action").value;
      if (!checked || finding.length < 12) throw new Error("Choose evidence status and document at least 12 characters.");
      state = propose(state, CASE_ID, action, "Source review: " + checked + ". Findings: " + finding);
      announce("Investigation submitted to simulated reviewer.");
    } else if (form.id === "review-form") {
      const decision = event.submitter?.dataset.decision || "accept";
      const note = document.getElementById("review-note").value.trim();
      if (note.length < 8) throw new Error("Please enter a review rationale (8 characters minimum).");
      state = review(state, CASE_ID, decision, note);
      announce(decision === "reject" ? "Returned to the operator for more information." : "Simulated reviewer decision recorded.");
    } else if (form.id === "followup-form") {
      const outcome = document.getElementById("resolution").value;
      const note = document.getElementById("closure-note").value.trim();
      if (note.length < 18) throw new Error("Document the next action in at least 18 characters.");
      state = closeReview(state, CASE_ID, outcome, note);
      announce("Administrative outcome saved. No clinical release authorized.");
    }
    save(); render(); window.scrollTo(0, 0);
  } catch (err) { announce(err.message, true); }
});
document.getElementById("reset-demo").addEventListener("click", () => {
  if (!window.confirm("Reset this pilot's local investigation and simulated decisions?")) return;
  state = freshState(); view = "queue"; save(); status.hidden = true; render(); window.scrollTo(0, 0);
});
render();
