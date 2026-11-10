import {
  POLICY, SCENARIOS, inspectEvidence, latestOnlyBaseline,
  competentRulesBaseline, benchmark, freshState, ensureState,
  propose, review, closeReview, issueGuard
} from "./engine.js";

const STORAGE_KEY = "trustledger-demo-state-v1";
let state = loadState();
let selectedId = SCENARIOS[0].id;
let currentView = "overview";
let toastTimeout = null;

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const displayDate = iso => new Date(iso).toLocaleString("en-GB", {
  timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short"
});
const sensorDate = iso => new Date(iso).toLocaleString("en-GB", {
  timeZone: "Africa/Nairobi", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
});

function loadState() {
  try { return ensureState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch (_) { return freshState(); }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (_) { announce("Local storage is unavailable. This session may not persist.", "error"); }
}
function announce(message, tone = "") {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = "toast " + tone;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 7000);
}
function kindInfo(kind) {
  if (kind === "gap") return { label: "MISSING DATA", css: "gap", icon: "◷" };
  if (kind === "excursion") return { label: "EXCURSION", css: "excursion", icon: "↗" };
  if (kind === "implausible") return { label: "SENSOR OUTLIER", css: "glitch", icon: "⚑" };
  return { label: "NO FLAGS", css: "clear", icon: "✓" };
}
function dispositionText(disposition) {
  return ({
    unresolved: "Not reviewed",
    awaiting_reviewer: "Awaiting quality review",
    authorized_hold: "Authorized hold recorded",
    authorized_investigation: "Investigation authorized",
    review_documented_hold: "Review documented · restriction continues",
    referred_site_authority: "Referred for site-authorized disposition",
    returned_to_operator: "Returned for correction",
    mock_clear: "Mock clear (control case only)"
  })[disposition] || "Unknown state";
}
function navigate(view) {
  if (!["overview", "evidence", "audit", "methods"].includes(view)) return;
  currentView = view;
  document.querySelectorAll(".content-section").forEach(s =>
    s.classList.toggle("visible", s.id === "section-" + view));
  document.querySelectorAll("[data-nav]").forEach(button => {
    const active = button.dataset.nav === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("view-name").textContent = ({
    overview: "Control room", evidence: "Evidence lab",
    audit: "Decision audit", methods: "Methods & limits"
  })[view];
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderStats() {
  const needs = SCENARIOS.filter(s => inspectEvidence(s.readings).needsReview).length;
  const authorized = SCENARIOS.filter(s =>
    state.cases[s.id].disposition === "authorized_hold").length;
  const blocked = state.issueAttempts.filter(a => !a.allowed).length;
  const stats = [
    ["DEMO WINDOWS", SCENARIOS.length, "Curated facility feed excerpts", "◈"],
    ["REVIEW NEEDED", needs, "Evidence not safe to assume", "⚑"],
    ["AUTHORIZED HOLDS", authorized, "After mock QA authorization", "⊘"],
    ["BLOCKED ISSUE ATTEMPTS", blocked, "Simulated blood unit issue desk", "⏣"],
  ];
  $("stat-grid").innerHTML = stats.map(([label, value, hint, icon]) =>
    '<div class="stat"><div class="stat-head"><span>' + escapeHtml(label) +
    '</span><span class="stat-icon">' + icon + '</span></div><div class="stat-value">' +
    value + '</div><div class="stat-foot">' + escapeHtml(hint) + '</div></div>').join("");
}
function renderCaseList() {
  $("case-list").innerHTML = SCENARIOS.map(s => {
    const info = kindInfo(inspectEvidence(s.readings).kind);
    const status = state.cases[s.id].disposition;
    return '<button type="button" class="case-option' + (s.id === selectedId ? ' selected' : '') +
      '" data-case-id="' + s.id + '" aria-pressed="' + (s.id === selectedId) + '">' +
      '<div class="case-top"><span class="case-id">' + escapeHtml(s.id) + '</span><span class="flag-badge ' +
      info.css + '">' + escapeHtml(info.label) + '</span></div>' +
      '<div class="case-title">' + escapeHtml(s.title) + '</div>' +
      '<div class="case-sub">' + escapeHtml(s.subtitle) + '</div>' +
      '<div class="case-bottom"><span>' + escapeHtml(s.facility) + ' · ' + escapeHtml(s.period) +
      '</span><span>' + (status === "unresolved" ? "↗ Open" : "• " + escapeHtml(dispositionText(status))) +
      '</span></div></button>';
  }).join("");
}
function plot(s) {
  const points = s.readings.map(r => ({ t: Date.parse(r.at), v: Number(r.c) }));
  const tMin = points[0].t, tMax = points[points.length - 1].t;
  const x = t => 26 + 588 * (t - tMin) / Math.max(1, tMax - tMin);
  const y = v => 122 - Math.min(10, Math.max(0, v)) * 9.65;
  const horizontal = [2, 6].map(v => '<line x1="26" y1="' + y(v) + '" x2="614" y2="' + y(v) +
    '" stroke="#88c5b7" stroke-dasharray="5 5" stroke-width="1"/>').join("");
  const vertical = [0, 1, 2, 3, 4, 5].map(i => '<line x1="' + (26 + i * 117.6) +
    '" y1="20" x2="' + (26 + i * 117.6) + '" y2="124" stroke="#edf1ef" stroke-width="1"/>').join("");
  const segments = [];
  let current = [];
  let gap = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const plausible = p.v >= POLICY.minReasonableC && p.v <= POLICY.maxReasonableC;
    if (i > 0 && (p.t - points[i - 1].t) / 3600000 > 1.1) {
      if (current.length) segments.push(current);
      current = [];
      gap = { from: x(points[i - 1].t), to: x(p.t) };
    }
    if (!plausible) { if (current.length) segments.push(current); current = []; continue; }
    current.push(x(p.t).toFixed(2) + "," + y(p.v).toFixed(2));
  }
  if (current.length) segments.push(current);
  const lines = segments.map(a => '<polyline points="' + a.join(" ") +
    '" fill="none" stroke="#078d85" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>').join("");
  const dots = points.map(p => {
    const implausible = p.v < POLICY.minReasonableC || p.v > POLICY.maxReasonableC;
    const bad = p.v > POLICY.maxC || p.v < POLICY.minC;
    return implausible
      ? '<g><circle cx="' + x(p.t) + '" cy="18" r="6" fill="#d7a044" stroke="#fff" stroke-width="2"/><text x="' +
        Math.min(570, Math.max(20, x(p.t) - 25)) + '" y="11" font-size="10" fill="#91631b">' + escapeHtml(p.v + "°C raw") + '</text></g>'
      : '<circle cx="' + x(p.t) + '" cy="' + y(p.v) + '" r="5" fill="' +
        (bad ? "#c15d49" : "#0d978b") + '" stroke="#fff" stroke-width="2"/>';
  }).join("");
  const gapOverlay = gap ? '<rect x="' + (gap.from + 11) + '" y="20" width="' +
    Math.max(0, gap.to - gap.from - 22) +
    '" height="104" rx="6" fill="#faeedb" opacity=".8"/><text x="' +
    ((gap.from + gap.to) / 2) + '" y="76" font-size="12" text-anchor="middle" font-weight="800" fill="#a77731">57h no readings</text>' : "";
  return '<div class="evidence-chart"><div class="chart-top"><span>Temperature readings (°C)</span><b>ILLUSTRATIVE 2–6°C BAND</b></div>' +
    '<svg viewBox="0 0 640 147" role="img" aria-label="Temperature evidence for ' + escapeHtml(s.title) +
    '. Breaks indicate missing readings."><rect x="26" y="' + y(6) + '" width="588" height="' +
    (y(2) - y(6)) + '" fill="#dcefe8" opacity=".5"/>' +
    vertical + horizontal + gapOverlay + lines + dots +
    '<text x="2" y="' + (y(6) + 3) + '" fill="#8ca5a2" font-size="9">6°</text>' +
    '<text x="2" y="' + (y(2) + 3) + '" fill="#8ca5a2" font-size="9">2°</text>' +
    '<text x="26" y="143" fill="#82979a" font-size="9">' + escapeHtml(sensorDate(s.readings[0].at)) +
    '</text><text x="614" y="143" text-anchor="end" fill="#82979a" font-size="9">' +
    escapeHtml(sensorDate(s.readings.at(-1).at)) + '</text></svg>' +
    '<div class="chart-legend"><span><span class="legend-dot"></span>Plausible reading</span><span><span class="legend-dot bad"></span>Out-of-band</span><span><span class="legend-dot unknown"></span>Missing/invalid data</span></div></div>';
}
function renderDetail() {
  const s = SCENARIOS.find(c => c.id === selectedId);
  const e = inspectEvidence(s.readings), c = state.cases[s.id];
  const kind = kindInfo(e.kind);
  const warning = e.needsReview ? "REVIEW REQUIRED · No verified safe conclusion"
    : "NO FLAGS IN THIS WINDOW · Human sign-off still required";
  const bannerClass = e.kind === "excursion" ? "red" : e.needsReview ? "" : "green";
  const evidenceDetails = e.flags.length
    ? e.flags.map(f => '<li class="' + (f.kind === "excursion" ? "excursion" : "") + '">' +
        escapeHtml(f.detail) + (f.endAt ? " · " + escapeHtml(sensorDate(f.at)) +
        " to " + escapeHtml(sensorDate(f.endAt)) : f.at ? " · " + escapeHtml(sensorDate(f.at)) : "") +
        '</li>').join("")
    : '<li class="clear">No missing, implausible or out-of-demo-band readings in this limited window. Not a clinical clearance.</li>';
  const outageContext = '<section class="source-context"><div class="panel-kicker">SOURCE-VERIFIED POWER CONTEXT</div>' +
    (s.powerOutages?.length ? s.powerOutages.map(o =>
      '<p><strong>' + escapeHtml(o.outage_id) + '</strong> · ' +
      escapeHtml(o.start_time.replace(" ", " ") + " EAT") + ' to ' + escapeHtml(o.end_time + " EAT") +
      ' · ' + escapeHtml(o.duration_hours) + ' hours · backup power ' +
      (o.backup_power_engaged ? '<strong>engaged</strong>' : '<strong>NOT engaged</strong>') +
      ' · <code>power_outages.csv</code></p>').join("") +
      '<p>Measured out-of-band temperatures overlap the documented outage in this facility. This temporal association is not proof of a specific unit’s exposure or a validated causal diagnosis.</p>' :
      '<p>No overlapping power-outage record was supplied for this excerpt. This does not establish why any logger readings are absent.</p>') +
    '<p><strong>Inventory provenance:</strong> the temperature source is facility-level. It contains no named-fridge-to-unit custody timeline. Unit IDs below are explicit supplemental synthetic fixtures; real affected-unit identification remains <strong>unverified</strong>.</p></section>';
  const canClose = e.needsReview && ["authorized_hold", "authorized_investigation"].includes(c.disposition);
  const closurePanel = canClose
    ? '<div class="form-card closure-panel"><div class="form-head"><b>Document investigation outcome</b><span class="role-tag reviewer">REVIEWER · SIMULATED</span></div>' +
      '<p>Close the paperwork or escalate to a site authority. These actions <strong>do not clear the underlying evidence or permit mock issue</strong>. A clinically valid disposition needs equipment/unit history, corroborating records and site SOP.</p>' +
      '<label class="field-label" for="closure-outcome">Administrative outcome</label><select id="closure-outcome">' +
      '<option value="continued_hold">Document review; restriction continues</option>' +
      '<option value="refer_site_authority">Refer to qualified site authority</option></select>' +
      '<label class="field-label" for="closure-note">Evidence considered and next action</label>' +
      '<textarea id="closure-note" placeholder="e.g. Logger readings absent; named equipment and unit locations not verified; request calibration logs and site review."></textarea>' +
      '<div class="form-actions"><button class="action-button" data-close-review>Record investigation outcome →</button></div></div>'
    : c.closureOutcome
      ? '<div class="review-status"><strong>DOCUMENTED REVIEW:</strong> ' + escapeHtml(dispositionText(c.disposition)) +
        ' · ' + escapeHtml(c.closureNote) + '. No clinical release was authorized.</div>'
      : '';
  const proposalOptions = e.needsReview
    ? '<option value="hold">Propose temporary hold for review</option><option value="investigate">Investigate / request more evidence</option>'
    : '<option value="clear_mock">Propose mock issue clearance (clean demo only)</option><option value="hold">Propose temporary hold</option><option value="investigate">Investigate / request more evidence</option>';
  const reviewerDisabled = !c.proposal || c.reviewerDecision ? " disabled" : "";
  const last = state.audit.find(a => a.caseId === s.id);
  $("case-detail").innerHTML =
    '<div class="detail-head"><div><div class="panel-kicker">CASE / ' + escapeHtml(s.id) + '</div><h2>' +
    escapeHtml(s.title) + '</h2><p>' + escapeHtml(s.facility) + ' · ' + escapeHtml(s.siteLabel) +
    '</p></div><span class="flag-badge ' + kind.css + '">' + kind.icon + " " + escapeHtml(kind.label) + '</span></div>' +
    '<div class="decision-banner ' + bannerClass + '"><span class="decision-symbol">' +
    (e.needsReview ? '⚑' : '✓') + '</span><div><strong>' + escapeHtml(warning) +
    '</strong><p>' + (e.kind === "gap" ? "The feed resumes at a normal temperature, but there is no evidence for the unobserved interval." :
      e.kind === "excursion" ? "An out-of-range facility reading is observed. Unit condition and exposure duration cannot be inferred." :
      e.kind === "implausible" ? "An extreme raw value was preserved and flagged as untrusted; sensor investigation is needed." :
      "This short sample window contains no detected anomalies. Qualified review remains a separate requirement.") + '</p></div></div>' +
    '<div class="section-divider">01 / MONITORING EVIDENCE <small>Source: starter synthetic CSV</small></div>' + plot(s) +
    '<div class="evidence-facts"><div class="fact"><label>Missing hours</label><strong>' + e.gapHours +
    '</strong></div><div class="fact"><label>Observed max*</label><strong>' +
    (e.max === null ? "—" : e.max.toFixed(1)) + '<small>°C</small></strong></div>' +
    '<div class="fact"><label>Data certainty</label><strong style="font-size:10px">' +
    escapeHtml(e.certainty) + '</strong></div></div><div class="section-divider">02 / EXPLANATION <small>' +
    e.flags.length + ' finding(s)</small></div><ul class="finding-list">' + evidenceDetails +
    '</ul>' + outageContext + '<p class="data-footnote">*Max excludes clearly implausible raw values, which remain listed in the evidence. ' +
    escapeHtml(s.evidenceScope) + '</p>' +
    '<div class="section-divider">03 / CANDIDATE INVENTORY <small>Added synthetic mapping</small></div>' +
    '<p class="data-footnote">' + escapeHtml(s.fixtureScope) + ' Candidate only: no actual unit exposure proven.</p>' +
    s.units.map(u => '<div class="unit-row"><div><code>' + escapeHtml(u) +
      '</code><br><small>SUPPLEMENTAL DEMO UNIT · RBC</small></div><button data-issue="' +
      escapeHtml(u) + '">Attempt mock issue ↗</button></div>').join("") +
    '<div class="section-divider">04 / HUMAN DECISION <small>' + escapeHtml(dispositionText(c.disposition)) +
    '</small></div><div class="form-card"><div class="form-head"><b>Operator proposal</b><span class="role-tag">OPERATOR · SIMULATED</span></div>' +
    '<p>Summarize the evidence and recommend a next step. The proposal does not change real blood inventory.</p>' +
    '<label class="field-label" for="operator-action">Proposed action</label><select id="operator-action">' +
    proposalOptions + '</select><label class="field-label" for="operator-reason">Operator rationale</label>' +
    '<textarea id="operator-reason" placeholder="e.g. 57 readings absent; fridge identity and unit history require verification."></textarea>' +
    '<div class="form-actions"><button class="action-button" data-propose>Submit for review →</button></div></div>' +
    '<div class="form-card"><div class="form-head"><b>Quality reviewer decision</b><span class="role-tag reviewer">REVIEWER · SIMULATED</span></div>' +
    (c.proposal ? '<p><strong>Submitted:</strong> ' + escapeHtml(c.proposal) + ' · ' +
      escapeHtml(c.reason) + '</p>' : '<p>No operator proposal yet. The reviewer cannot decide until one is recorded.</p>') +
    '<label class="field-label" for="reviewer-note">Reviewer rationale</label>' +
    '<textarea id="reviewer-note" placeholder="Document the reason for your approval, change or rejection." ' +
    reviewerDisabled + '></textarea><div class="form-actions"><button class="action-button" data-review="accept"' +
    reviewerDisabled + '>Accept</button><button class="action-button warning" data-review="change"' +
    reviewerDisabled + '>Change → hold</button><button class="action-button danger" data-review="reject"' +
    reviewerDisabled + '>Reject</button></div></div>' + closurePanel +
    '<div class="review-status">CASE STATUS: <strong>' + escapeHtml(dispositionText(c.disposition)) +
    '</strong>. Unresolved or abnormal evidence always blocks the simulated issue attempt.</div>' +
    '<div class="audit-peek"><span>◷</span><span>' + (last ?
      '<b>Last action:</b> ' + escapeHtml(last.action) + ' · ' + escapeHtml(last.detail) :
      '<b>No actions yet.</b> Issue attempts and review decisions appear in Decision audit.') +
    '</span></div>';
}
function renderBenchmark() {
  const b = benchmark();
  $("lab-headline").textContent = "Normal latest values do not fill in missing history.";
  $("lab-explanation").textContent = "Between 30 September 09:00 and 2 October 19:00 EAT the facility feed supplies no readings. That is a 58-hour interval with 57 expected hourly samples absent.";
  $("lab-gap").innerHTML = '57<span>missing hours</span>';
  const metrics = [
    ["Latest reading only", b.latest, "Simple threshold alert"],
    ["Competent rule monitor", b.strong, "Excursions + gaps + outliers"],
    ["TrustLedger evidence feature", b.feature, "Same detection; reasons & review flow"],
  ];
  $("benchmark-summary").innerHTML = metrics.map(([name, v, subtitle]) =>
    '<div class="benchmark-metric"><b>' + escapeHtml(name) + '</b><strong>' + v.correct +
    ' / ' + v.total + ' correct</strong><small>' + escapeHtml(subtitle) + ' · recall ' +
    Math.round(v.sensitivity * 100) + '%</small></div>').join("");
  const badge = (pred, truth) =>
    '<span class="table-tag ' + (pred === truth ? (pred ? "yes" : "no") : "missed") + '">' +
    (pred ? "Review" : "No review") + '</span>';
  $("benchmark-table").innerHTML = b.rows.map(r =>
    '<tr><td>' + escapeHtml(r.title) + '</td><td>' + (r.truth ? "Review" : "No review") +
    '</td><td>' + badge(r.latest, r.truth) + '</td><td>' + badge(r.strong, r.truth) +
    '</td><td>' + badge(r.feature, r.truth) + '</td></tr>').join("");
  $("benchmark-caveat").textContent = b.caveat;
}
function renderAudit() {
  $("audit-count").textContent = String(state.audit.length);
  $("audit-total").textContent = state.audit.length + " event" + (state.audit.length === 1 ? "" : "s");
  $("audit-list").innerHTML = state.audit.length ? state.audit.map(a =>
    '<div class="audit-row"><span class="audit-icon">' + (a.action.includes("BLOCKED") ? "⊘" :
      a.action === "PROPOSAL" ? "↗" : a.action.includes("ALLOWED") ? "✓" : "◈") +
    '</span><div><h3>' + escapeHtml(a.action.replaceAll("_", " ")) +
    ' · ' + escapeHtml(a.caseId) + '</h3><p>' + escapeHtml(a.actor) + ' · ' +
    escapeHtml(a.detail) + '</p></div><time title="' + escapeHtml(a.at) + '">' +
    escapeHtml(displayDate(a.at)) + '</time></div>').join("")
    : '<div class="empty-audit"><span>◫</span>No decision records yet.<br>Select a case and attempt a simulated issue or submit a proposal.</div>';
}
function updateConnection() {
  const offline = !navigator.onLine;
  $("connection-pill").classList.toggle("offline", offline);
  $("connection-text").textContent = offline ? "Offline · local demo" : "Online · local demo";
}
function render() {
  renderStats();
  renderCaseList();
  renderDetail();
  renderBenchmark();
  renderAudit();
  updateConnection();
}
document.addEventListener("click", event => {
  const target = event.target;
  const nav = target.closest("[data-nav]");
  if (nav) { navigate(nav.dataset.nav); return; }
  const card = target.closest("[data-case-id]");
  if (card) { selectedId = card.dataset.caseId; renderCaseList(); renderDetail(); return; }
  const issue = target.closest("[data-issue]");
  if (issue) {
    try {
      const result = issueGuard(state, selectedId, issue.dataset.issue);
      state = result.state; save(); render();
      announce((result.allowed ? "MOCK ISSUE PERMITTED: " : "MOCK ISSUE BLOCKED: ") + result.reason,
        result.allowed ? "good" : "error");
    } catch (err) { announce(err.message, "error"); }
    return;
  }
  if (target.closest("[data-propose]")) {
    try {
      state = propose(state, selectedId, $("operator-action").value, $("operator-reason").value);
      save(); render(); announce("Operator proposal saved. Switch to the reviewer panel to decide.", "good");
    } catch (err) { announce(err.message, "error"); }
    return;
  }
  if (target.closest("[data-close-review]")) {
    try {
      state = closeReview(state, selectedId, $("closure-outcome").value, $("closure-note").value);
      save(); render();
      announce("Incident review recorded; mock issue remains blocked. Site clinical disposition is outside this demo.", "good");
    } catch (err) { announce(err.message, "error"); }
    return;
  }
  const reviewButton = target.closest("[data-review]");
  if (reviewButton) {
    try {
      state = review(state, selectedId, reviewButton.dataset.review, $("reviewer-note").value);
      save(); render(); announce("Reviewer decision recorded: " +
        dispositionText(state.cases[selectedId].disposition), "good");
    } catch (err) { announce(err.message, "error"); }
    return;
  }
});
$("reset-demo").addEventListener("click", () => {
  if (!window.confirm("Clear all browser-local demo decisions and issue attempts?")) return;
  state = freshState(); save(); render(); announce("Demo data reset. Original synthetic evidence preserved.", "good");
});
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js")
    .catch(() => { /* Works online without offline caching. */ }));
}
render();
