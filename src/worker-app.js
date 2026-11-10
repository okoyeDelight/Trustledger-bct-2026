import {
  SCENARIOS, inspectEvidence, ensureState, freshState,
  propose, review, closeReview, issueGuard, buildHandoffPacket
} from "./engine.js";

const CASE_ID = "TL-024";
const SOURCE = SCENARIOS.find(c => c.id === CASE_ID);
const EVIDENCE = inspectEvidence(SOURCE.readings);
const GAP = EVIDENCE.flags.find(f => f.kind === "gap");
const KEY = "trustledger-one-reader-demo-v1";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function loadState() {
  try { return ensureState(JSON.parse(localStorage.getItem(KEY))); }
  catch { return freshState(); }
}
let state = loadState();
let view = "inbox";
let issueResult = "";
const root = document.getElementById("screen");
const notice = document.getElementById("notice");
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { notify("Local storage was unavailable; this session may not persist."); }
}
function notify(text) {
  notice.textContent = text;
  notice.hidden = false;
}
function clearNotice() { notice.hidden = true; notice.textContent = ""; }
function caseState() { return state.cases[CASE_ID]; }
function statusName() {
  const d = caseState().disposition;
  return ({
    unresolved: "Needs attention",
    awaiting_reviewer: "Awaiting review",
    returned_to_operator: "More information needed",
    authorized_hold: "Review recorded · restricted",
    authorized_investigation: "Investigation ongoing",
    referred_site_authority: "Referred for site review",
    review_documented_hold: "Review documented · restricted",
    mock_clear: "Demo review complete"
  })[d] || "Follow-up required";
}
function isReviewed() {
  return !["unresolved", "awaiting_reviewer", "returned_to_operator"].includes(caseState().disposition);
}
function statusClass() {
  return caseState().disposition === "unresolved" ? "" :
    caseState().disposition === "awaiting_reviewer" ? "blue" : "green";
}
function stepNav(n, label) {
  const dots = [1,2,3,4].map(i =>
    '<span class="' + (i <= n ? "done" : "") + '"></span>').join("");
  return '<div class="step-line"><span class="step">' + escapeHtml(label) +
    '</span><div class="step-bar" aria-label="Step ' + n +
    ' of 4">' + dots + '</div></div>';
}
function backButton(target, label = "Back") {
  return '<button type="button" class="breadcrumb" data-go="' + target +
    '"><span aria-hidden="true">←</span> ' + label + '</button>';
}
function mainHeading(kicker, title, lead) {
  return '<div class="section-kicker">' + kicker + '</div><h1 tabindex="-1">' +
    title + '</h1><p class="lead">' + lead + '</p>';
}
function dateLabel(at) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(at));
}
function inbox() {
  return mainHeading("ONE MONITORING SOURCE · HSP-024", "Incidents",
    "Problems that need attention. Open a case to see what happened and what to do next.") +
    '<section class="issue-list" aria-label="Incident list">' +
    '<div class="issue-header"><span>Monitoring source A <span aria-hidden="true">·</span> facility-level data</span><span>1 case</span></div>' +
    '<div class="issue-card"><div class="issue-details"><span class="issue-tag ' + statusClass() +
    '">' + escapeHtml(statusName()) + '</span>' +
    '<h2>Temperature records missing</h2>' +
    '<p><strong>' + EVIDENCE.gapHours + ' expected hourly readings</strong> are absent. The last recorded ' +
    EVIDENCE.latest.toFixed(1) + '°C cannot verify the missing interval.</p>' +
    '</div><div class="issue-actions"><button class="button" data-go="evidence">' +
    'Open incident <span aria-hidden="true">→</span></button></div></div></section>' +
    '<p class="footnote">This example is calculated from the organizer’s synthetic HSP-024 facility readings. ' +
    '“Source A” is a demo label—not a verified physical reader or refrigerator.</p>';
}
function evidenceView() {
  const c = caseState();
  const next = c.disposition === "awaiting_reviewer" ? "review" :
    isReviewed() ? "outcome" : "investigate";
  const label = next === "investigate" ? "Start investigation" :
    next === "review" ? "Continue to review" : "View recorded outcome";
  return backButton("inbox", "All incidents") +
    stepNav(1, "STEP 1 · UNDERSTAND") +
    mainHeading("INCIDENT TL-024 · HSP-024", "Temperature records are missing",
      "The latest reading is normal, but the available record cannot verify the missing hours.") +
    '<div class="comparison" aria-label="Recorded temperature versus missing evidence">' +
    '<div class="datum"><small>Last recorded temperature</small><strong>' +
    EVIDENCE.latest.toFixed(1) + '°C</strong><small>Observed, not estimated</small></div>' +
    '<div class="versus" aria-hidden="true">≠</div>' +
    '<div class="datum missing"><small>Missing hourly records</small><strong>' +
    EVIDENCE.gapHours + '</strong><small>Temperature unknown</small></div></div>' +
    '<section class="interval" aria-label="Original data gap">' +
    '<h3>What the source actually records</h3>' +
    '<div class="interval-line">' +
    '<div class="interval-end"><strong>3.9°C</strong>' +
    escapeHtml(dateLabel(GAP.at)) + '</div>' +
    '<div class="interval-gap">NO DATA</div>' +
    '<div class="interval-end"><strong>4.3°C</strong>' +
    escapeHtml(dateLabel(GAP.endAt)) + '</div></div>' +
    '<p class="interval-note">57 expected hourly readings are missing between the recorded endpoints. No temperatures have been filled in.</p></section>' +
    '<div class="explain-panel"><p><strong>Why this needs attention</strong></p>' +
    '<p>We cannot conclude that conditions stayed within range while the logger was not recording. ' +
    'A worker needs to check supporting records and document what can—and cannot—be established.</p></div>' +
    '<div class="section-actions"><button class="button" data-go="' + next + '">' +
    label + ' <span aria-hidden="true">→</span></button>' +
    '<button class="button secondary" data-go="inbox">Back to incidents</button></div>' +
    '<p class="footnote">Source: original synthetic <code>temperature_logs.csv</code>, facility HSP-024. ' +
    'The dataset provides no verified device identity or blood-unit occupancy history.</p>';
}
function investigate() {
  const c = caseState();
  const previous = c.reason || "";
  return backButton("evidence", "Review evidence") +
    stepNav(2, "STEP 2 · INVESTIGATE") +
    mainHeading("YOUR TASK · SIMULATED OPERATOR", "Record what you found",
      "Explain the evidence and what still needs checking. It's okay to say the cause is unknown.") +
    '<div class="explain-panel"><p><strong>Known:</strong> 57 expected readings are missing. ' +
    'The latest reading is 4.2°C.</p><p><strong>Unknown:</strong> conditions during the gap, ' +
    'why the readings stopped, and any actual device-to-unit exposure.</p></div>' +
    '<form id="investigation-form" novalidate>' +
    '<div class="form-field"><label for="findings">Your investigation notes</label>' +
    '<textarea id="findings" name="findings" required minlength="15" maxlength="3000" ' +
    'placeholder="What is confirmed? Which supporting records should be checked?">' +
    escapeHtml(previous) + '</textarea>' +
    '<span class="form-help">We need a brief, meaningful explanation (at least 15 characters). Do not guess missing temperatures.</span></div>' +
    '<div class="form-field"><label for="recommendation">Recommended next step</label>' +
    '<select id="recommendation" name="recommendation">' +
    '<option value="investigate">Continue investigation / request more evidence</option>' +
    '<option value="hold">Recommend a precautionary hold (simulation)</option></select>' +
    '<span class="form-help">This is a proposal only. It does not change any real inventory.</span></div>' +
    '<div class="section-actions"><button class="button" type="submit">' +
    'Submit for review <span aria-hidden="true">→</span></button></div></form>';
}
function reviewView() {
  const c = caseState();
  if (!c.proposal || c.disposition !== "awaiting_reviewer") return outcomeView();
  const proposalName = c.proposal === "hold" ?
    "Recommend a precautionary hold (demo)" : "Continue investigating / request evidence";
  return backButton("inbox", "All incidents") +
    stepNav(3, "STEP 3 · REVIEW") +
    mainHeading("SIMULATED QUALITY REVIEWER", "Review the investigation",
      "A separate authorized reviewer would perform this task in a real facility. Here we demonstrate the handoff in one browser.") +
    '<section class="review-box"><h2>Submitted by the simulated operator</h2>' +
    '<div class="summary-row"><span class="summary-label">Recommendation</span>' +
    '<span class="summary-value">' + escapeHtml(proposalName) + '</span></div>' +
    '<div class="summary-row"><span class="summary-label">Findings</span>' +
    '<span class="summary-value">' + escapeHtml(c.reason) + '</span></div>' +
    '<div class="summary-row"><span class="summary-label">Evidence</span>' +
    '<span class="summary-value">57 expected readings missing; actual temperatures during the gap unknown.</span></div></section>' +
    '<form id="review-form" novalidate>' +
    '<div class="form-field"><label>Review decision</label>' +
    '<div class="selection">' +
    '<label class="choice"><input type="radio" name="decision" value="accept" checked>' +
    '<span><strong>Accept the proposed next step</strong><small>Record the investigation/hold as reviewed, without any clinical release.</small></span></label>' +
    '<label class="choice"><input type="radio" name="decision" value="reject">' +
    '<span><strong>Return for more information</strong><small>Ask the operator to update the findings.</small></span></label>' +
    '<label class="choice"><input type="radio" name="decision" value="change">' +
    '<span><strong>Change to precautionary hold</strong><small>Demo action only; still requires site-specific clinical procedure.</small></span></label>' +
    '</div></div>' +
    '<div class="form-field"><label for="review-note">Reason for this decision</label>' +
    '<textarea id="review-note" name="review-note" required minlength="8" maxlength="3000" ' +
    'placeholder="Why is this the appropriate next step?"></textarea>' +
    '<span class="form-help">At least 8 characters. The decision is logged in this browser.</span></div>' +
    '<div class="section-actions"><button class="button" type="submit">Record decision →</button>' +
    '<button type="button" class="button secondary" data-go="evidence">View evidence again</button></div></form>';
}
function outcomeView() {
  const c = caseState();
  if (c.disposition === "unresolved" || c.disposition === "returned_to_operator")
    return evidenceView();
  if (c.disposition === "awaiting_reviewer") return reviewView();
  const closureAllowed = ["authorized_hold", "authorized_investigation"].includes(c.disposition);
  const closed = !!c.closureOutcome;
  const action = c.reviewerDecision === "change" ? "Changed to precautionary hold" :
    c.proposal === "hold" ? "Precautionary hold documented" :
    "Further investigation authorized";
  const followUp = closed ? '<div class="explain-panel"><p><strong>Follow-up recorded:</strong> ' +
      (c.closureOutcome === "continued_hold" ? "Restriction continues." :
        "Referred to site authority.") + '</p><p>' + escapeHtml(c.closureNote) +
      '</p><p>Documenting follow-up does not remove the missing evidence or authorize a clinical release.</p></div>'
    : closureAllowed ? '<details class="subtle-box"><summary>Record a follow-up or referral</summary>' +
      '<p>Use this when there is a further administrative outcome. This cannot clear blood for use.</p>' +
      '<form id="followup-form"><div class="form-field"><label for="followup-choice">Follow-up</label>' +
      '<select id="followup-choice"><option value="refer_site_authority">Refer to site authority</option>' +
      '<option value="continued_hold">Document continuing restriction</option></select></div>' +
      '<div class="form-field"><label for="followup-note">Evidence and next action</label>' +
      '<textarea id="followup-note" required minlength="18" maxlength="3000" ' +
      'placeholder="What further evidence or site decision is needed?"></textarea></div>' +
      '<button class="button secondary" type="submit">Record follow-up</button></form></details>' : "";
  const lastAttempt = state.issueAttempts.find(a => a.caseId === CASE_ID);
  return backButton("inbox", "All incidents") +
    stepNav(4, "STEP 4 · OUTCOME") +
    mainHeading("INCIDENT TL-024", "Decision recorded",
      "The handoff is documented. The missing evidence is still missing, so further action may be needed.") +
    '<div class="explain-panel"><p class="emphasis">' + escapeHtml(statusName()) + '</p>' +
    '<p><strong>Reviewer action:</strong> ' + escapeHtml(action) + '.</p>' +
    '<p><strong>Reason:</strong> ' + escapeHtml(c.reviewerNote) + '</p>' +
    '<p>No real inventory or clinical release decision was made.</p></div>' +
    followUp +
    '<div class="section-actions"><button class="button" data-go="inbox">Return to incidents →</button>' +
    '<button class="button secondary" data-go="history">View case history</button></div>' +
    '<details class="subtle-box"><summary>Test a simulated issue restriction</summary>' +
    '<p>Use a <strong>fictional demo unit</strong> only. The organizer’s facility temperatures have no verified unit-to-fridge mapping.</p>' +
    '<button class="button secondary tiny" data-issue-check>Attempt mock issue</button>' +
    (lastAttempt ? '<p id="issue-result"><strong>' +
      (lastAttempt.allowed ? "MOCK ISSUE PERMITTED" : "MOCK ISSUE BLOCKED") +
      ':</strong> ' + escapeHtml(lastAttempt.reason) + '</p>' : '') +
    '</details>' +
    '<p class="footnote">This is a simulated administrative review. A qualified professional and a validated site SOP are required for real clinical dispositions.</p>';
}
function historyView() {
  const items = state.audit.filter(a => a.caseId === CASE_ID);
  const entries = items.length ? items.map(a =>
    '<div class="audit-item"><strong>' + escapeHtml(a.action.replaceAll("_", " ")) + '</strong>' +
    '<time datetime="' + escapeHtml(a.at) + '">' + escapeHtml(dateLabel(a.at)) + ' EAT</time>' +
    '<p>' + escapeHtml(a.detail) + '</p></div>').join("") :
    '<div class="blank">No actions have been recorded yet. Open the incident to begin.</div>';
  return mainHeading("LOCAL CASE RECORD", "History",
      "Decisions and demo issue attempts are recorded in this browser. They are not a protected hospital audit trail.") +
    '<div class="audit-list" id="audit-list">' + entries + '</div>' +
    '<div class="section-actions"><button class="button" data-go="evidence">Open incident →</button>' +
    '<button class="button secondary" data-export>Download synthetic case record</button></div>' +
    '<p class="footnote">The downloadable JSON includes source-labelled evidence and states explicitly that no hospital system is connected.</p>';
}
function aboutView() {
  return mainHeading("ABOUT THIS WORKING PROTOTYPE", "One source. One incident.",
      "TrustLedger helps a worker understand a cold-chain monitoring problem, record findings and route them to a reviewer.") +
    '<div class="help-section"><h2>What works here?</h2>' +
    '<p>Original synthetic source readings are checked for missing hours; an incident can be investigated, proposed, reviewed and logged. Actions persist locally in the browser.</p></div>' +
    '<div class="help-section"><h2>What is simulated?</h2>' +
    '<p>Monitoring source A is not a verified physical device. Reviewer roles, issue controls and inventory unit links are simulations. There are no staff accounts, shared database, device feed or hospital integrations.</p></div>' +
    '<div class="help-section"><h2>What comes next?</h2>' +
    '<p>A worker-reported incident would enter the same guided process. Real equipment identity, authorized staff roles, escalation rules and clinical procedures require blood-service expert validation.</p></div>' +
    '<div class="section-actions"><button class="button secondary" data-reset>Reset this local demonstration</button>' +
    '<button class="button" data-go="inbox">Go to incidents →</button></div>';
}
function render(focus = false) {
  clearNotice();
  document.querySelectorAll("[data-view]").forEach(b => {
    const active = b.dataset.view === (["history", "about"].includes(view) ? view : "inbox");
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  const screens = {
    inbox, evidence: evidenceView, investigate, review: reviewView,
    outcome: outcomeView, history: historyView, about: aboutView
  };
  root.innerHTML = (screens[view] || inbox)();
  if (focus) {
    root.scrollIntoView({ block: "start", behavior: "instant" });
    const heading = root.querySelector("h1");
    if (heading) heading.focus({ preventScroll: true });
  }
}
function show(next) {
  view = next; render(true);
}
function error(msg) { notify(msg instanceof Error ? msg.message : String(msg)); }
document.addEventListener("click", ev => {
  const target = ev.target;
  const goto = target.closest("[data-go], [data-view]");
  if (goto) {
    ev.preventDefault();
    show(goto.dataset.go || goto.dataset.view); return;
  }
  if (target.closest("[data-issue-check]")) {
    try {
      const result = issueGuard(state, CASE_ID, SOURCE.units[0]);
      state = result.state;
      persist();
      render();
      notify(result.allowed ? "Mock issue permitted for demo only; no clinical release." :
        "MOCK ISSUE BLOCKED: missing evidence remains unresolved.");
    } catch (e) { error(e); }
    return;
  }
  if (target.closest("[data-export]")) {
    try {
      const data = buildHandoffPacket(state, CASE_ID);
      const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "trustledger-one-source-synthetic-handoff.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Synthetic case record downloaded; no hospital system connected.");
    } catch(e) { error(e); }
    return;
  }
  if (target.closest("[data-reset]")) {
    if (!window.confirm("Reset all case actions recorded in this browser?")) return;
    state = freshState(); persist(); show("inbox"); notify("Local demonstration reset.");
  }
});
document.addEventListener("submit", ev => {
  if (!["investigation-form", "review-form", "followup-form"].includes(ev.target.id)) return;
  ev.preventDefault();
  try {
    if (ev.target.id === "investigation-form") {
      const note = document.getElementById("findings").value.trim();
      const recommendation = document.getElementById("recommendation").value;
      if (note.length < 15) throw new Error("Please describe the findings in at least 15 characters.");
      state = propose(state, CASE_ID, recommendation, note);
      persist(); show("review");
    } else if (ev.target.id === "review-form") {
      const decision = ev.target.querySelector('input[name="decision"]:checked')?.value;
      const reason = document.getElementById("review-note").value.trim();
      state = review(state, CASE_ID, decision, reason);
      persist();
      if (state.cases[CASE_ID].disposition === "returned_to_operator")
        show("investigate");
      else show("outcome");
      if (decision === "reject") notify("Returned for more information. Update the findings to resubmit.");
    } else {
      const resolution = document.getElementById("followup-choice").value;
      const note = document.getElementById("followup-note").value.trim();
      state = closeReview(state, CASE_ID, resolution, note);
      persist(); show("outcome");
    }
  } catch(e) { error(e); }
});
render();