import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("customer login shows only own service, inbox and bills at phone and desktop widths", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("Email address")
    .fill("lakshmi.customer@sunpower.local");
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My solar service" }),
  ).toBeVisible();
  await expect(
    page.getByText("Welcome, Lakshmi Iyer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your bills" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark as read" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark as read" }).first().click();
  await expect(
    page.getByRole("button", { name: "Mark as read" }).first(),
  ).toBeEnabled();
  expect((await page.request.get("/api/projects")).status()).toBe(403);
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "My solar service" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({
    path: `output/qa/${info.project.name}-customer-portal.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email address").fill("sneha.customer@sunpower.local");
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Welcome, Sneha & Arun", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Welcome, Lakshmi Iyer", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
