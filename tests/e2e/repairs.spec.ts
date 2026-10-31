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
