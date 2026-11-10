import { test, expect } from "@playwright/test";

/**
 * Genuine browser renders for Claude EVALUATOR and human design review.
 * Saved to Playwright's test-results and uploaded by GitHub Actions.
 * Images show synthetic fixture data; they are NOT proof of clinical safety.
 */
test("capture operational screens and decision consequence", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("#page-title")).toBeVisible();
  await expect(page.locator("#case-detail")).toContainText("57-hour blind spot");
  await page.screenshot({
    path: testInfo.outputPath("01-control-room-before.png"),
    fullPage: true,
    animations: "disabled"
  });

  await page.locator('button[data-issue="DEMO-RBC-024-A"]').click();
  await expect(page.locator("#toast")).toContainText("MOCK ISSUE BLOCKED");
  await page.screenshot({
    path: testInfo.outputPath("02-blocked-mock-issue.png"),
    fullPage: true,
    animations: "disabled"
  });

  await page.locator('[data-nav="evidence"]').click();
  await expect(page.locator("#benchmark-caveat")).toContainText("no demonstrated advantage");
  await page.screenshot({
    path: testInfo.outputPath("03-evidence-lab.png"),
    fullPage: true,
    animations: "disabled"
  });

  await page.locator('[data-nav="audit"]').click();
  await expect(page.locator("#audit-list")).toContainText("MOCK ISSUE BLOCKED");
  await page.screenshot({
    path: testInfo.outputPath("04-audit.png"),
    fullPage: true,
    animations: "disabled"
  });
});
