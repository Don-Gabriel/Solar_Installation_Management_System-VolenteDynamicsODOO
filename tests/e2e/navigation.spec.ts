import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function login(page: any, email = "admin@sunpower.local") {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Good morning|Good afternoon/ }),
  ).toBeVisible();
}
test("project next step and back navigation preserve search and stage", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects?search=Priya&status=enquiry");
  await expect(page.locator(".project-row")).toHaveCount(1);
  await page.locator(".project-row").click();
  await expect(
    page.getByRole("heading", { name: "Record a site survey", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go to this step" }).click();
  await expect(
    page.getByRole("tab", { name: "Site survey", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Back to project list" }).click();
  await expect(page.getByLabel("Search projects")).toHaveValue("Priya");
  await expect(page.getByLabel("Filter by stage")).toHaveValue("enquiry");
  await page.reload();
  await expect(page.locator(".project-row")).toHaveCount(1);
});
test("phone menu supports Escape and new screens remain readable", async ({
  page,
}, info) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  for (const [url, heading] of [
    ["/team", "Team & access"],
    ["/barcodes?product=INV3&status=available", "Barcode labels"],
    ["/help", "Screen guide"],
    ["/inventory?tab=serials", "Stock & deliveries"],
    ["/service", "Repairs & warranty"],
    ["/reports", "Money & reports"],
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      url,
    ).toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      axe.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(",")}`,
      ),
      url,
    ).toEqual([]);
  }
  await page.goto("/barcodes?product=INV3&status=available");
  await expect(page.locator(".barcode-card").first()).toBeVisible();
  await expect(
    page.locator(".device-barcode").first().locator("rect").first(),
  ).toBeAttached();
  await page.screenshot({
    path: `output/qa/${info.project.name}-labels-mobile.png`,
    fullPage: false,
  });
});
test("staff roles show different workspaces and server access rules", async ({
  browser,
}, info) => {
  for (const [role, email] of [
    ["sales", "sales"],
    ["surveyor", "surveyor"],
    ["warehouse", "warehouse"],
    ["technician", "arjun"],
    ["support", "support"],
    ["accounts", "accounts"],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      isMobile: false,
    });
    const page = await context.newPage();
    await login(page, `${email}@sunpower.local`);
    const team = await page.request.get("/api/team");
    expect(team.status()).toBe(403);
    const report = await page.request.get("/api/reports");
    expect(report.status()).toBe(role === "accounts" ? 200 : 403);
    const nav = page.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    await expect(nav.getByRole("link", { name: "Team & access" })).toHaveCount(
      0,
    );
    await expect(
      nav.getByRole("link", { name: "Money & reports" }),
    ).toHaveCount(role === "accounts" ? 1 : 0);
    if (role === "technician") {
      const jobs = await page.request.get("/api/jobs").then((r) => r.json());
      expect(jobs.items.length).toBeGreaterThan(0);
      await page.goto("/jobs");
      await expect(
        page.getByRole("heading", { name: "My installation jobs" }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `output/qa/${info.project.name}-role-${role}.png`,
      fullPage: false,
    });
    await context.close();
  }
});
