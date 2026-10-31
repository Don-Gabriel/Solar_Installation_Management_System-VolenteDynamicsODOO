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
test("[INT-09 UXP-03] interrupted enquiry recovers its draft and in-app/back navigation offers stay or discard", async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto("/projects");
  await page.getByRole("link", { name: "New enquiry", exact: true }).click();
  await page.getByLabel("Customer name").fill("Recoverable unsent caller");
  await page.getByLabel("Phone number").fill("9876543201");
  await page
    .getByLabel("Installation address")
    .fill("Synthetic interrupted call site");
  await page
    .getByRole("combobox", { name: "System capacity" })
    .selectOption("unknown");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByText(/You are offline. This change was not submitted/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "New enquiry", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByLabel("Customer name")).toHaveValue(
    "Recoverable unsent caller",
  );
  await expect(page.getByText(/Recovered unsent draft/)).toBeVisible();
  await page.locator(".back-link").click();
  await expect(
    page.getByRole("dialog", { name: "Leave unsaved changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay on this screen" }).click();
  await expect(page.getByLabel("Customer name")).toHaveValue(
    "Recoverable unsent caller",
  );
  await page.goBack();
  await expect(
    page.getByRole("dialog", { name: "Leave unsaved changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discard changes and leave" }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New enquiry", exact: true }).click();
  await expect(page.getByLabel("Customer name")).toHaveValue("");
});
test("[INT-02 INT-03 INT-04 CRM-03 CRM-06] returning caller chooses a site, saves unknown size and records shared access instructions", async ({
  page,
}) => {
  await login(page, "support@sunpower.local");
  await page.goto("/projects/new");
  await page
    .getByLabel("Search existing customer by phone or name")
    .fill("Lakshmi");
  await page
    .getByRole("combobox", { name: "Customer record", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Existing installation site", exact: true })
    .selectOption({ index: 1 });
  await expect(
    page.getByRole("link", { name: /Open SP-/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "System capacity" })
    .selectOption("unknown");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lakshmi Iyer", exact: true }),
  ).toBeVisible();
  await page
    .getByText("Customer, sites & call history", { exact: true })
    .click();
  await expect(
    page.getByText("Same site", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByLabel("Customer call / follow-up note")
    .fill("Repeated call: survey date requested");
  await page.getByRole("button", { name: "Save call note" }).click();
  await expect(
    page.getByText(/Repeated call: survey date requested/).last(),
  ).toBeVisible();
  await page.getByText("Edit site access", { exact: true }).click();
  await page
    .getByLabel("Gate, roof and site access instructions")
    .fill("Ask reception for the roof key");
  await page
    .getByLabel("Site instruction change reason")
    .fill("Confirmed on customer call");
  await page.getByRole("button", { name: "Save site instructions" }).click();
  await expect(
    page.getByText("Site access: Ask reception for the roof key", {
      exact: true,
    }),
  ).toBeVisible();
});
test("[UXP-01] project next step and back navigation preserve search and stage", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects?search=Priya&status=enquiry");
  await expect(page.locator(".project-row")).toHaveCount(1);
  await page.locator(".project-row").click();
  await expect(
    page.getByRole("heading", { name: "Record a site survey", exact: true }),
  ).toBeVisible();
  const previousProjectUrl = page.url();
  await page.getByRole("button", { name: "Go to this step" }).click();
  await expect(
    page.getByRole("tab", { name: "Site survey", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Back to previous screen" }).click();
  // The first Back restores the project URL before the explicit tab visit.
  await expect(page).toHaveURL(previousProjectUrl);
  await page.getByRole("button", { name: "Back to previous screen" }).click();
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
test("[UXP-02] staff roles show permitted next steps, different workspaces and server access rules", async ({
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
    if (role === "sales") {
      await page.goto("/projects?search=Priya&status=enquiry");
      await page.locator(".project-row").first().click();
      await expect(
        page.getByRole("region", { name: "Next project step" }),
      ).toContainText("Handled by: Administrator, Site surveyor");
    }
    await page.screenshot({
      path: `output/qa/${info.project.name}-role-${role}.png`,
      fullPage: false,
    });
    await context.close();
  }
});
