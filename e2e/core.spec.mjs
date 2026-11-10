import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#page-title")).toContainText("From uncertainty");
});

test("renders critical cases and shows provenance uncertainty", async ({ page }) => {
  await expect(page.locator("#case-list [data-case-id]")).toHaveCount(4);
  await expect(page.locator("#case-detail")).toContainText("The 57-hour blind spot");
  await expect(page.locator("#case-detail")).toContainText("57");
  await expect(page.locator("#case-detail")).toContainText("Added synthetic mapping");
  await expect(page.locator("#case-detail")).toContainText("No verified safe conclusion");
});

test("mock issue is blocked; action is recorded in audit", async ({ page }) => {
  await page.locator('button[data-issue="DEMO-RBC-024-A"]').click();
  await expect(page.locator("#toast")).toContainText("MOCK ISSUE BLOCKED");
  await page.locator('[data-nav="audit"]').click();
  await expect(page.locator("#audit-list")).toContainText("MOCK ISSUE BLOCKED");
  await expect(page.locator("#audit-total")).toContainText("1 event");
});

test("operator proposes hold and reviewer accepts; issue stays blocked", async ({ page }) => {
  await page.locator("#operator-reason").fill("The 57 missing records leave the fridge status unverified.");
  await page.locator("[data-propose]").click();
  await expect(page.locator("#case-detail")).toContainText("Awaiting quality review");
  await page.locator("#reviewer-note").fill("Authorize a precautionary synthetic hold pending verification.");
  await page.locator('[data-review="accept"]').click();
  await expect(page.locator("#case-detail")).toContainText("Authorized hold recorded");
  await page.locator('button[data-issue="DEMO-RBC-024-A"]').click();
  await expect(page.locator("#toast")).toContainText("MOCK ISSUE BLOCKED");
});

test("negative control can only be mock-cleared after reviewer approval", async ({ page }) => {
  await page.locator('[data-case-id="TL-024-CONTROL"]').click();
  await page.locator('button[data-issue="DEMO-RBC-024-C1"]').click();
  await expect(page.locator("#toast")).toContainText("MOCK ISSUE BLOCKED");
  await page.locator("#operator-reason").fill("Four consecutive normal demo readings; no flags in this window.");
  await page.locator("[data-propose]").click();
  await page.locator("#reviewer-note").fill("Approve the simulated clean control only, not clinical release.");
  await page.locator('[data-review="accept"]').click();
  await page.locator('button[data-issue="DEMO-RBC-024-C1"]').click();
  await expect(page.locator("#toast")).toContainText("MOCK ISSUE PERMITTED");
});

test("evidence lab is honest about rule-based baseline parity", async ({ page }) => {
  await page.locator('[data-nav="evidence"]').click();
  await expect(page.locator("#benchmark-summary")).toContainText("1 / 4 correct");
  await expect(page.locator("#benchmark-summary")).toContainText("4 / 4 correct");
  await expect(page.locator("#benchmark-caveat")).toContainText("no demonstrated advantage");
  // #benchmark-table is the TBODY: four scenario rows, not four plus header.
  await expect(page.locator("#benchmark-table tr")).toHaveCount(4);
});

test("screen is usable at the selected viewport without global overflow", async ({ page }) => {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.inner + 2);
  await expect(page.locator("#case-detail [data-propose]")).toBeVisible();
});


test("source-preserving data-quality audit is visible and correctly qualified", async ({ page }) => {
  await page.locator('[data-nav="evidence"]').click();
  const audit = page.locator("#quality-audit");
  await expect(audit).toBeVisible();
  await expect(audit).toContainText("55");
  await expect(audit).toContainText("1,852");
  await expect(audit).toContainText("12,273");
  await expect(audit).toContainText("Validated: unknown");
  await expect(audit).toContainText("candidate duplicates are not confirmed identities");
});


test("documentation gaps are not misrepresented as missing deliveries or unsafe units", async ({ page }) => {
  await page.locator('[data-nav="evidence"]').click();
  const proof = page.locator("#receipt-evidence");
  await expect(proof.locator("summary")).toBeVisible();
  await proof.locator("summary").click();
  await expect(proof).toHaveAttribute("open", "");
  await expect(proof).toContainText("TRF-005463");
  await expect(proof).toContainText("U2511-NKR-006818-RBC");
  await expect(proof).toContainText("1,046");
  await expect(proof).toContainText("No timestamp ≠ no delivery");
  await expect(proof).toContainText("not our main clinical-safety case");
});


test("source-backed power outage context is auditable, not a guessed unit exposure", async ({ page }) => {
  await page.locator('[data-case-id="TL-NBO-HOT"]').click();
  const detail = page.locator("#case-detail");
  await expect(detail).toContainText("OUT-00009");
  await expect(detail).toContainText("3.83");
  await expect(detail).toContainText("NOT engaged");
  await expect(detail).toContainText("unit");
  await expect(detail).toContainText("unverified");
  await expect(detail).toContainText("7.9");
});

test("quality reviewer documents restricted case closure without enabling synthetic issue", async ({ page }) => {
  await page.locator('[data-case-id="TL-NBO-HOT"]').click();
  await page.locator("#operator-action").selectOption("investigate");
  await page.locator("#operator-reason").fill("7.9C observed during a power outage; require equipment and unit trace.");
  await page.locator("[data-propose]").click();
  await page.locator("#reviewer-note").fill("Document the evidence and refer to the qualified site authority.");
  await page.locator('[data-review="accept"]').click();
  await expect(page.locator(".closure-panel")).toBeVisible();
  await page.locator("#closure-outcome").selectOption("refer_site_authority");
  await page.locator("#closure-note").fill("Outage 00009, recorded temperatures and absent fridge-to-unit links need local SOP review.");
  await page.locator("[data-close-review]").click();
  await expect(page.locator("#case-detail")).toContainText("Referred for site-authorized disposition");
  await page.locator('button[data-issue="DEMO-RBC-NBO-H1"]').click();
  await expect(page.locator("#toast")).toContainText("MOCK ISSUE BLOCKED");
  await page.locator('[data-nav="audit"]').click();
  await expect(page.locator("#audit-list")).toContainText("REVIEW CLOSED NO RELEASE");
});

test("full-year monitoring gap statistics remain distinct from four-case accuracy evaluation", async ({ page }) => {
  await page.locator('[data-nav="evidence"]').click();
  await expect(page.locator(".whole-dataset")).toContainText("381 of 387");
  await expect(page.locator(".whole-dataset")).toContainText("12,273");
  await expect(page.locator("#benchmark-table tr")).toHaveCount(4);
});


test("candidate units are from time-bounded fictional custody, not claimed from sensor data", async ({ page }) => {
  await expect(page.locator("#case-detail")).toContainText("FICTIONAL TIMED OCCUPANCY");
  await expect(page.locator("#case-detail")).toContainText("ILLUSTRATIVE-FR-A");
  await expect(page.locator("#case-detail")).toContainText("no original device-to-unit exposure is verified");
  await page.locator('[data-case-id="TL-NBO-HOT"]').click();
  await expect(page.locator("#case-detail")).toContainText("ILLUSTRATIVE-FR-B");
});
