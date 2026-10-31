/** Run after installing the demo APK on a connected Android emulator or test device. */
import { _android as android } from "@playwright/test";
import { writeFile } from "node:fs/promises";
process.loadEnvFile(".env");
const devices = await android.devices();
const device = devices.find((d) => d.serial().startsWith("emulator-"));
if (!device) throw Error("Connect the test emulator first.");
try {
  await device.shell("am force-stop local.sunpower.operations");
  await device.shell("am start -n local.sunpower.operations/.MainActivity");
  const view = await device.webView({ pkg: "local.sunpower.operations" });
  const page = await view.page();
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Switch demo user" }).click();
  await page.getByLabel("Filter by role").selectOption("customer");
  await page.getByLabel("Search people").fill("lakshmi");
  await page.getByRole("button", { name: /Lakshmi Iyer/ }).click();
  await page.getByRole("heading", { name: "My solar service" }).waitFor();
  const status = await page.evaluate(
    async () => (await fetch("/api/reports")).status,
  );
  if (status !== 403) throw Error("Customer unexpectedly has staff access");
  await writeFile(
    "output/qa/android-native-customer.png",
    await device.screenshot(),
  );
  await page.getByRole("button", { name: "Switch demo user" }).click();
  await page.getByLabel("Filter by role").selectOption("admin");
  await page.getByRole("button", { name: /Don Gabriel/ }).click();
  await page
    .getByRole("heading", { name: /Good morning|Good afternoon/ })
    .waitFor();
  await writeFile(
    "output/qa/android-native-admin.png",
    await device.screenshot(),
  );
  await device.shell("am force-stop local.sunpower.operations");
  await device.shell("am start -n local.sunpower.operations/.MainActivity");
  const restarted = await device.webView({ pkg: "local.sunpower.operations" });
  await (
    await restarted.page()
  )
    .getByRole("heading", { name: /Good morning|Good afternoon/ })
    .waitFor();
  console.log(
    JSON.stringify({
      androidEmulator: "PASS",
      login: "PASS",
      demoSwitching: "PASS",
      customerIsolation: "PASS",
      restart: "PASS",
    }),
  );
} finally {
  await device.close();
}
