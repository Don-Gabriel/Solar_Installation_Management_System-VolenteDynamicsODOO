import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
async function login(page: any, email = "admin@sunpower.local") {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Good morning|Good afternoon/ }),
  ).toBeVisible();
}
test("[CRM-09 BIL-10] repair appointment, diagnosis, approval, real photo and service document on desktop and phone", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/service");
  await page
    .getByRole("button", { name: "New repair request", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Installation", exact: true })
    .selectOption({ index: 1 });
  await expect(page.getByLabel("What the customer reported")).toBeVisible();
  await page
    .getByLabel("Find customer's installation")
    .fill("different household");
  await expect(
    page.getByRole("combobox", { name: "Installation", exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("What the customer reported")).toBeHidden();
  await page.getByLabel("Find customer's installation").fill("");
  await expect(
    page
      .getByRole("combobox", { name: "Installation", exact: true })
      .locator("option"),
  ).not.toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Installation", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("What the customer reported")
    .fill("Synthetic browser test: inverter stopped producing power");
  await page
    .getByRole("button", { name: "Save repair request", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .locator(".ticket-card")
    .filter({
      hasText: "Synthetic browser test: inverter stopped producing power",
    })
    .first()
    .getByRole("button", { name: "Open repair request" })
    .click();
  await page
    .getByRole("link", { name: "Find technician and schedule visit" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visits & scheduling", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find available times" }).click();
  await page.locator(".slot").first().click();
  await page.locator(".crew-options input").first().check();
  await page
    .getByRole("combobox", { name: "Crew lead", exact: true })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm appointment" }),
  ).toBeHidden();
  const url = new URL(page.url());
  const ticket = url.searchParams.get("ticket");
  await page.goto("/service?ticket=" + ticket);
  await page.getByRole("button", { name: "Start visit", exact: true }).click();
  await page
    .locator(".component-choice")
    .filter({ hasText: /inverter/i })
    .first()
    .locator("input[type=checkbox]")
    .check();
  await page
    .getByLabel("Fault found")
    .fill("Loose internal connection confirmed, repaired and tested");
  await page
    .getByRole("button", { name: "Save diagnosis and estimate" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Repair estimate", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel(
      /Customer approval name and reference|Covered-work review reference/,
    )
    .fill("Synthetic customer approval recorded by phone");
  await page
    .getByRole("button", { name: "Record approval", exact: true })
    .click();
  await expect(
    page.getByText(/Approved by recorded customer agreement/),
  ).toBeVisible();
  const input = page.locator("input[type=file]").first();
  await input.setInputFiles({
    name: "synthetic-repair.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#536d58" },
    })
      .png()
      .toBuffer(),
  });
  await expect(
    page.getByText("Photo saved to the repair visit."),
  ).toBeVisible();
  await page
    .getByLabel("Work completed and test result")
    .fill("Connection repaired and output verified onsite");
  await page
    .getByRole("button", {
      name: "Complete repair and create service document",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: /Service (invoice|statement) INV-/ }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Demo service document · tax not configured. Original installation invoice remains unchanged.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`),
  ).toEqual([]);
  await page.screenshot({
    path: `output/qa/${info.project.name}-repair-document.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("[BIL-08] invoice correction needs a second reviewer and displays the retained original and credit", async ({
  page,
}) => {
  await login(page);
  const projects = await page.request
    .get("/api/projects?status=completed&limit=20")
    .then((r) => r.json());
  const project = projects.items[0];
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("tab", { name: "Quotation & payment" }).click();
  const record = page.locator(".invoice-record").first();
  await record
    .getByText("Receipts, credits & corrections", { exact: true })
    .click();
  await record.getByText("Request invoice correction", { exact: true }).click();
  const reason = `Browser credit review ${Date.now()}`;
  await record.getByLabel("Credit amount (₹)").fill("10");
  await record.getByLabel("Correction reason").fill(reason);
  await record
    .getByRole("button", { name: "Submit correction for review" })
    .click();
  await expect(
    record
      .getByText(
        "Awaiting review by another accounts officer or administrator.",
      )
      .first(),
  ).toBeVisible();
  if (
    !(await page
      .getByRole("button", { name: "Sign out", exact: true })
      .isVisible())
  )
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "accounts@sunpower.local");
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("tab", { name: "Quotation & payment" }).click();
  const reviewed = page.locator(".invoice-record").first();
  await reviewed
    .getByText("Receipts, credits & corrections", { exact: true })
    .click();
  const request = reviewed.locator(".ticket-card").filter({ hasText: reason });
  await request
    .getByRole("checkbox", {
      name: "Approve credit and any replacement invoice",
    })
    .check();
  await request
    .getByLabel("Correction review reason")
    .fill("Checked invoice against customer agreement");
  await request
    .getByRole("button", { name: "Review correction", exact: true })
    .click();
  await expect(request.getByText("Approved", { exact: true })).toBeVisible();
  await expect(
    reviewed.getByText(/Credit note CN-/).filter({ hasText: reason }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Quotation & payment" }).click();
  await page
    .locator(".invoice-record")
    .first()
    .getByText("Receipts, credits & corrections", { exact: true })
    .click();
  await expect(
    page.getByText(/Credit note CN-/).filter({ hasText: reason }),
  ).toBeVisible();
});
test("coordinator can schedule but cannot open finance or team administration", async ({
  page,
}) => {
  await login(page, "coordinator@sunpower.local");
  await page.goto("/schedule");
  await expect(
    page.getByRole("heading", { name: "Find a free technician or crew" }),
  ).toBeVisible();
  const result = await page.request.get("/api/reports");
  expect(result.status()).toBe(403);
  expect((await page.request.get("/api/team")).status()).toBe(403);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`),
  ).toEqual([]);
});

test("[SUR-08] coordinator books a two-person survey crew against the selected site", async ({
  page,
}) => {
  await login(page, "coordinator@sunpower.local");
  const before = await page.request.get("/api/schedule").then((r) => r.json());
  await page.goto("/schedule");
  await page.getByLabel("Visit purpose").selectOption("survey");
  await page.getByLabel("Survey site").selectOption({ index: 1 });
  const site = await page.getByLabel("Survey site").inputValue();
  await page.getByLabel("Crew size").fill("2");
  await page
    .getByRole("button", { name: "Find available times", exact: true })
    .click();
  await page.locator(".slot").first().click();
  await page.locator(".crew-options input").nth(0).check();
  await page.locator(".crew-options input").nth(1).check();
  await page.getByLabel("Crew lead").selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Confirm appointment", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm appointment", exact: true }),
  ).toBeHidden();
  const after = await page.request.get("/api/schedule").then((r) => r.json());
  const added = after.visits.filter(
    (v: any) => !before.visits.some((old: any) => old.id === v.id),
  );
  expect(added).toHaveLength(1);
  expect(added[0].project_id).toBe(site);
  expect(added[0].ticket_id).toBeNull();
  expect(added[0].kind).toBe("survey");
  expect(added[0].crew).toHaveLength(2);
  expect(added[0].crew.filter((c: any) => c.is_lead)).toHaveLength(1);
});

test("[SCH-02 SCH-09] a holiday search shows alternatives and a tracked follow-up that can be completed", async ({
  page,
}) => {
  await login(page, "coordinator@sunpower.local");
  await page.goto("/schedule");
  await page.getByText("Company holidays", { exact: true }).click();
  await page.getByLabel("Nonworking date").fill("2027-12-25");
  await page
    .getByLabel("Holiday reason")
    .fill("Synthetic holiday for exception workflow");
  await page.getByRole("button", { name: "Save holiday", exact: true }).click();
  await expect(
    page.getByText("2027-12-25 · Synthetic holiday for exception workflow", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Repair request", exact: true })
    .selectOption({ index: 1 });
  await page.getByLabel("From", { exact: true }).fill("2027-12-25");
  await page.getByLabel("To", { exact: true }).fill("2027-12-25");
  await page
    .getByRole("button", { name: "Find available times", exact: true })
    .click();
  await expect(
    page.getByText("No crew in the requested window.", { exact: false }),
  ).toBeVisible();
  const task = page
    .locator(".ticket-card")
    .filter({ hasText: "No qualified crew from 2027-12-25 through 2027-12-25" })
    .first();
  await expect(task).toBeVisible();
  await task.getByText("Record outcome", { exact: true }).click();
  await task
    .getByLabel("What was done and agreed")
    .fill("Customer agreed to review the offered next working-day appointment");
  await task
    .getByRole("button", { name: "Finish follow-up", exact: true })
    .click();
  await expect(task).toBeHidden();
});
