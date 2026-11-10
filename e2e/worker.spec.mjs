import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({page}) => {
  await page.goto("/worker.html");
  await page.evaluate(() => localStorage.removeItem("trustledger-one-reader-demo-v1"));
  await page.reload();
});

test("first-time worker has one clear incident and no dashboard overload", async ({page}, testInfo) => {
  await expect(page.getByRole("heading",{name:"Incidents"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Temperature records missing"})).toBeVisible();
  await expect(page.locator(".issue-card")).toHaveCount(1);
  await expect(page.locator(".issue-card")).toContainText("57 expected hourly readings");
  await expect(page.locator(".issue-card")).toContainText("4.2°C");
  await expect(page.locator(".primary-nav button")).toHaveCount(3);
  await expect(page.getByText("Evidence lab",{exact:true})).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("DEMO-RBC-024-A");
  await page.screenshot({path:"test-results/worker-inbox-"+testInfo.project.name+".png",fullPage:true});
  await page.getByRole("button",{name:/Open incident/}).click();
  await expect(page.getByRole("heading",{name:"Temperature records are missing"})).toBeVisible();
  await expect(page.getByText("NO DATA",{exact:true})).toBeVisible();
  await expect(page.getByText(/No temperatures have been filled in/)).toBeVisible();
});

test("guided case runs from real source evidence through operator, reviewer, outcome and history", async ({page}, testInfo) => {
  await page.getByRole("button",{name:/Open incident/}).click();
  await page.getByRole("button",{name:/Start investigation/}).click();
  await expect(page.getByRole("heading",{name:"Record what you found"})).toBeVisible();
  await page.getByLabel("Your investigation notes").fill(
    "The 57 missing hourly values cannot verify storage conditions; request the logger and equipment records."
  );
  await page.getByRole("button",{name:/Submit for review/}).click();
  await expect(page.getByRole("heading",{name:"Review the investigation"})).toBeVisible();
  await expect(page.getByText("SIMULATED QUALITY REVIEWER")).toBeVisible();
  await page.getByLabel("Reason for this decision").fill("Refer to the site authority while monitoring evidence remains incomplete.");
  await page.getByRole("button",{name:/Record decision/}).click();
  await expect(page.getByRole("heading",{name:"Decision recorded"})).toBeVisible();
  await expect(page.getByText("Investigation ongoing",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/worker-outcome-"+testInfo.project.name+".png",fullPage:true});
  await page.getByRole("button",{name:/Return to incidents/}).click();
  await expect(page.locator(".issue-card")).toContainText("Investigation ongoing");
  await page.getByRole("button",{name:"History"}).click();
  await expect(page.locator("#audit-list")).toContainText("PROPOSAL");
  await expect(page.locator("#audit-list")).toContainText("ACCEPT");
  await page.reload();
  await expect(page.locator("#audit-list")).toContainText("PROPOSAL");
  await expect(page.locator("#audit-list")).toContainText("ACCEPT");
});

test("return for more information has a real resubmission path", async ({page}) => {
  await page.getByRole("button",{name:/Open incident/}).click();
  await page.getByRole("button",{name:/Start investigation/}).click();
  await page.getByLabel("Your investigation notes").fill("Logger stopped recording and the reason is unverified.");
  await page.getByRole("button",{name:/Submit for review/}).click();
  await page.getByLabel("Return for more information").check();
  await page.getByLabel("Reason for this decision").fill("Please request the equipment service and logger logs.");
  await page.getByRole("button",{name:/Record decision/}).click();
  await expect(page.getByRole("heading",{name:"Record what you found"})).toBeVisible();
  await page.getByLabel("Your investigation notes").fill(
    "Logger stopped recording. We will request device service logs and site escalation."
  );
  await page.getByRole("button",{name:/Submit for review/}).click();
  await page.getByLabel("Reason for this decision").fill("Return noted and investigation can continue.");
  await page.getByRole("button",{name:/Record decision/}).click();
  await expect(page.getByText("Investigation ongoing",{exact:true})).toBeVisible();
});

test("follow-up and fictional issue attempt stay distinctly non-clinical", async ({page}) => {
  await page.getByRole("button",{name:/Open incident/}).click();
  await page.getByRole("button",{name:/Start investigation/}).click();
  await page.getByLabel("Your investigation notes").fill(
    "Temperature evidence absent; recommend investigation without any clinical disposition."
  );
  await page.getByRole("button",{name:/Submit for review/}).click();
  await page.getByLabel("Reason for this decision").fill("A site reviewer needs original logger records.");
  await page.getByRole("button",{name:/Record decision/}).click();
  await page.getByText("Record a follow-up or referral").click();
  await page.getByLabel("Evidence and next action").fill(
    "Referred to qualified site review; source facility data cannot prove unit exposure."
  );
  await page.getByRole("button",{name:"Record follow-up"}).click();
  await expect(page.getByText("Referred for site review",{exact:true})).toBeVisible();
  await page.getByText("Test a simulated issue restriction").click();
  await page.getByRole("button",{name:"Attempt mock issue"}).click();
  await expect(page.locator("#issue-result")).toContainText("MOCK ISSUE BLOCKED");
  await expect(page.locator("#issue-result")).toContainText("incomplete");
  await page.getByRole("button",{name:"View case history"}).click();
  await expect(page.locator("#audit-list")).toContainText("REVIEW CLOSED NO RELEASE");
  await expect(page.locator("#audit-list")).toContainText("MOCK ISSUE BLOCKED");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button",{name:"Download synthetic case record"}).click()
  ]);
  const obj = JSON.parse(await readFile(await download.path(),"utf8"));
  expect(obj.source_case.case_id).toBe("TL-024");
  expect(obj.evidence.missing_expected_hourly_records).toBe(57);
  expect(obj.candidate_inventory.confirmed_unit_exposure).toBe(false);
  expect(obj.simulated_issue_control.clinical_release_authorized).toBe(false);
  expect(obj.integration_status).toBe("EXPORT_ONLY_NO_EXTERNAL_SYSTEM_CONNECTED");
});

test("mobile first screen fits viewport without horizontal scrolling", async ({page}) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole("button",{name:/Open incident/}).click();
  const evidenceOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(evidenceOverflow).toBe(false);
});
