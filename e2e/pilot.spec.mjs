import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/pilot/");
  await page.evaluate(() => localStorage.removeItem("trustledger-one-source-pilot-v1"));
  await page.reload();
});

test("one source starts as one clear incident with no live reader claims", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  await expect(page.locator(".incident-row")).toHaveCount(1);
  await expect(page.locator(".incident-row")).toContainText("57 expected hourly measurements");
  await expect(page.locator(".queue-top")).toContainText("No live reader connection");
  await expect(page.getByRole("button", { name: /Open incident/ })).toBeVisible();
  await mkdir("test-results/screens", { recursive: true });
  await page.screenshot({ path: "test-results/screens/" + test.info().project.name + "-queue.png", fullPage: true });
  const w = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(w.width).toBeLessThanOrEqual(w.client + 1);
});

test("source-backed evidence is understandable and does not invent 57 temperatures", async ({ page }) => {
  await page.getByRole("button", { name: /Open incident/ }).click();
  await expect(page.getByRole("heading", { name: "Understand the problem" })).toBeVisible();
  await expect(page.locator(".unobserved")).toContainText("57 missing");
  await expect(page.locator(".evidence-window")).toContainText("3.9");
  await expect(page.locator(".evidence-window")).toContainText("4.3");
  await expect(page.locator(".meaning")).toContainText("do not identify a particular refrigerator");
  await mkdir("test-results/screens", { recursive: true });
  await page.screenshot({ path: "test-results/screens/" + test.info().project.name + "-evidence.png", fullPage: true });
  await page.getByRole("button", { name: /Start investigation/ }).click();
  await expect(page.getByRole("heading", { name: "Record your findings" })).toBeVisible();
});

test("complete one-source investigation, review, outcome, mock issue block and history", async ({ page }) => {
  await page.getByRole("button", { name: /Open incident/ }).click();
  await page.getByRole("button", { name: /Start investigation/ }).click();
  await page.locator("#check-result").selectOption("Additional equipment records need to be requested");
  await page.locator("#finding-text").fill("Original source records show a 57-hour logging gap. Device and unit locations remain unknown.");
  await page.locator("#proposed-action").selectOption("hold");
  await page.getByRole("button", { name: /Submit for review/ }).click();
  await expect(page.getByRole("heading", { name: "Review the investigation" })).toBeVisible();
  await expect(page.locator(".submitted-box")).toContainText("57-hour logging gap");
  await page.locator("#review-note").fill("Simulated acceptance: request equipment logs and refer per site SOP.");
  await page.getByRole("button", { name: /Accept recommendation/ }).click();
  await expect(page.getByRole("heading", { name: "Record the next action" })).toBeVisible();
  await page.locator("#resolution").selectOption("refer_site_authority");
  await page.locator("#closure-note").fill("Refer missing history to site authority and request calibrated logger and unit-location records.");
  await page.getByRole("button", { name: /Record outcome/ }).click();
  await expect(page.getByRole("heading", { name: "Investigation recorded" })).toBeVisible();
  await expect(page.locator(".final-warning")).toContainText("Restriction still applies");
  await page.getByRole("button", { name: /Test mock issue restriction/ }).click();
  await expect(page.locator(".guard-result")).toContainText("MOCK ISSUE BLOCKED");
  await page.locator(".activity summary").click();
  await expect(page.locator(".activity")).toContainText("REVIEW CLOSED NO RELEASE");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Investigation recorded" })).toBeVisible();
  await page.getByRole("button", { name: /Return to incidents/ }).click();
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  await expect(page.locator(".incident-row")).toContainText("Referred to site authority");
  await page.getByRole("button", { name: /Open incident/ }).click();
  await expect(page.getByRole("heading", { name: "Investigation recorded" })).toBeVisible();
});

test("reviewer can return a case for more information before a new proposal", async ({ page }) => {
  await page.getByRole("button", { name: /Open incident/ }).click();
  await page.getByRole("button", { name: /Start investigation/ }).click();
  await page.locator("#check-result").selectOption("Only source temperature records are available");
  await page.locator("#finding-text").fill("Records are incomplete, equipment investigation has not yet been completed.");
  await page.getByRole("button", { name: /Submit for review/ }).click();
  await page.locator("#review-note").fill("Need source logger maintenance evidence before completing the investigation.");
  await page.getByRole("button", { name: /Return for more information/ }).click();
  await expect(page.getByRole("heading", { name: "Record your findings" })).toBeVisible();
  await expect(page.locator(".return-note")).toContainText("Need source logger maintenance evidence");
  await page.locator("#check-result").selectOption("Additional equipment records need to be requested");
  await page.locator("#finding-text").fill("Maintenance evidence is still needed; no unit or device identity can be inferred.");
  await page.getByRole("button", { name: /Submit for review/ }).click();
  await expect(page.getByRole("heading", { name: "Review the investigation" })).toBeVisible();
});

test("reset clears only the local pilot flow", async ({ page }) => {
  await page.getByRole("button", { name: /Open incident/ }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#reset-demo").click();
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  await expect(page.locator(".incident-row")).toContainText("Needs investigation");
});
