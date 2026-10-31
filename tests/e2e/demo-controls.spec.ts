import { test, expect } from "@playwright/test";
test("demo switcher filters accounts, preserves RBAC, returns to admin and keeps navigation history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Switch demo user" }).click();
  await page.getByLabel("Filter by role").selectOption("customer");
  await page.getByLabel("Search people").fill("lakshmi");
  await page.getByRole("button", { name: /Lakshmi Iyer/ }).click();
  await expect(
    page.getByRole("heading", { name: "My solar service" }),
  ).toBeVisible();
  expect((await page.request.get("/api/reports")).status()).toBe(403);
  await page.getByRole("button", { name: "Switch demo user" }).click();
  await page.getByLabel("Filter by role").selectOption("admin");
  await page.getByRole("button", { name: /Don Gabriel/ }).click();
  await expect(
    page.getByRole("button", { name: "Switch demo user" }),
  ).toHaveText(/Administrator/);
  // Build actual in-app history, without assuming a project's parent screen.
  await page.locator('.work-shortcuts a[href="/inventory"]').click();
  await expect(
    page.getByRole("heading", { name: "Stock & deliveries" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Page controls" })
    .getByRole("button", { name: "Back", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Good morning|Good afternoon/ }),
  ).toBeVisible();
  await page.locator('.work-shortcuts a[href="/projects"]').click();
  await page.getByRole("link", { name: "New enquiry", exact: true }).click();
  await page.getByLabel("Customer name").fill("Keep this unsaved entry");
  await page
    .getByRole("navigation", { name: "Page controls" })
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await expect(page.getByLabel("Customer name")).toHaveValue(
    "Keep this unsaved entry",
  );
  await page
    .getByRole("navigation", { name: "Page controls" })
    .getByRole("button", { name: "Back", exact: true })
    .click();
  await page.getByRole("button", { name: "Discard changes and leave" }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
});
