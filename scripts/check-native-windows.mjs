/** Launch the packaged Windows payload and verify login and real role isolation. */
import { _electron as electron } from "@playwright/test";
import { resolve } from "node:path";
process.loadEnvFile(".env");
const app = await electron.launch({
  executablePath: resolve(
    "output/native/windows/win-unpacked/SunPower Operations.exe",
  ),
  args: ["--user-data-dir=" + resolve("tmp/native-qa-" + Date.now())],
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Switch demo user" }).click();
  await page.getByLabel("Filter by role").selectOption("customer");
  await page.getByLabel("Search people").fill("lakshmi");
  await page.getByRole("button", { name: /Lakshmi Iyer/ }).click();
  await page.getByRole("heading", { name: "My solar service" }).waitFor();
  const blocked = await page.evaluate(
    async () => (await fetch("/api/reports")).status,
  );
  if (blocked !== 403) throw Error("Customer unexpectedly has staff access");
  await page.screenshot({ path: "output/qa/windows-native-customer.png" });
  await page.getByRole("button", { name: "Switch demo user" }).click();
  await page.getByLabel("Filter by role").selectOption("admin");
  await page.getByRole("button", { name: /Don Gabriel/ }).click();
  await page
    .getByRole("heading", { name: /Good morning|Good afternoon/ })
    .waitFor();
  await page.screenshot({ path: "output/qa/windows-native-admin.png" });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  console.log(
    JSON.stringify({
      windowsPackagedApp: "PASS",
      login: "PASS",
      demoSwitching: "PASS",
      customerIsolation: "PASS",
      returnedToAdmin: "PASS",
    }),
  );
} finally {
  await app.close();
}
