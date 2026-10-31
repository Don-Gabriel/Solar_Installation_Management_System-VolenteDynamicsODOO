import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
try {
  process.loadEnvFile(".env");
} catch {}
const data = JSON.parse(await readFile("output/guide-data/demo.json", "utf8"));
await mkdir("output/guide-screens", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const base = "http://127.0.0.1:3001";
async function shot(id) {
  await page.locator("h1,h2").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `output/guide-screens/${id}.png`,
    fullPage: false,
  });
}
await page.goto(base);
await shot("login");
await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page
  .getByRole("heading", { name: /Good morning|Good afternoon/ })
  .waitFor();
await shot("home");
for (const [id, url] of [
  ["projects", "/projects"],
  ["new", "/projects/new"],
  ["stock", "/inventory"],
  ["barcodes", "/barcodes?product=INV3&status=available"],
  ["team", "/team"],
  ["jobs", "/jobs"],
  ["service", "/service"],
  ["reports", "/reports"],
  ["help", "/help"],
]) {
  await page.goto(base + url);
  await page
    .getByRole("status", { name: "Loading records" })
    .waitFor({ state: "hidden" });
  await shot(id);
}
const chosen = {
  survey: data.projects.find((p) => p.customer_name === "Thomas George"),
  quote: data.projects.find((p) => p.customer_name === "Sneha & Arun"),
  delivery: data.projects.find((p) => p.customer_name === "Faisal Rahman"),
  installation: data.projects.find((p) => p.customer_name === "Sneha & Arun"),
  passport: data.projects.find((p) => p.customer_name === "Abdul Kareem"),
  subsidy: data.projects.find((p) => p.customer_name === "Lakshmi Iyer"),
  activity: data.projects.find((p) => p.customer_name === "Abdul Kareem"),
};
for (const [tab, p] of Object.entries(chosen)) {
  await page.goto(base + `/projects/${p.id}?tab=${tab}`);
  await page
    .getByRole("heading", { name: p.customer_name, exact: true })
    .waitFor();
  await shot(tab === "delivery" ? "packing" : tab);
}
await page.goto(
  base +
    `/projects/${data.projects.find((p) => p.customer_name === "Priya Menon").id}`,
);
await page.getByRole("heading", { name: "Priya Menon", exact: true }).waitFor();
await shot("detail");
await page.goto(base + "/enquire");
await shot("public");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base);
await page
  .getByRole("heading", { name: /Good morning|Good afternoon/ })
  .waitFor();
await shot("mobile-home");
await browser.close();
console.log("Captured 21 guide screenshots from the running app.");
