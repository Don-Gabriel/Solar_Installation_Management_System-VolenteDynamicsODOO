import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import JsBarcode from "jsbarcode";
async function signIn(page: any) {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Good morning|Good afternoon/ }),
  ).toBeVisible();
}
test("[UXP-02] responsive navigation, saved next steps and accessible core screens", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await page.goto("/api/refresh-app");
  await expect(
    page.getByRole("heading", { name: "Load the latest SunPower app" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load latest app", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Good morning|Good afternoon/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `output/qa/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  const widths =
    testInfo.project.name === "chromium"
      ? [360, 390, 430, 768, 1280, 1440]
      : [testInfo.project.name === "webkit" ? 390 : 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `Overview overflow at ${width}`,
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(",")}`,
    ),
  ).toEqual([]);
  await page.getByRole("link", { name: "New enquiry", exact: true }).click();
  const name = `Browser QA ${testInfo.project.name} ${randomUUID().slice(0, 5)}`;
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Phone number").fill("9876543210");
  await page
    .getByLabel("Installation address")
    .fill("Synthetic browser test site, Kochi");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const projectUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Quotation & payment" }).click();
  await expect(
    page.getByText("Survey approval required", { exact: true }),
  ).toBeVisible();
  expect(
    await page.getByRole("button", { name: "Generate quotation" }).isEnabled(),
  ).toBe(false);
  await page.getByRole("tab", { name: "Site survey", exact: true }).click();
  await page.getByRole("button", { name: "Record site survey" }).click();
  await page.getByLabel("Usable roof area").fill("36");
  await page.getByLabel("Monthly bill").fill("3500");
  await page.getByLabel("Roof direction").selectOption("South");
  await page.getByLabel("Tilt (degrees)").fill("12");
  await page.getByLabel("Cable distance").fill("18");
  await page
    .getByRole("checkbox", { name: "Grid connection is suitable" })
    .check();
  await page.getByRole("button", { name: "Save survey", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Approve survey", exact: true })
    .click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Quotation & payment" }).click();
  await page.getByRole("button", { name: "Generate quotation" }).click();
  await expect(
    page.getByRole("button", { name: "Record customer acceptance" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record customer acceptance" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invoices & collections" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Next project step" })
      .getByRole("heading", {
        name: "Record the advance payment",
        exact: true,
      }),
  ).toBeVisible();
  await expect(
    page.getByText("Your role can handle this step.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page
    .getByLabel("Transaction / receipt reference")
    .fill(`QA-${randomUUID()}`);
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page
      .getByRole("region", { name: "Next project step" })
      .getByRole("heading", { name: "Reserve the equipment", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Packing & delivery" }).click();
  await page
    .getByRole("button", { name: "Reserve stock for this order" })
    .click();
  await expect(page.getByLabel("Device serial number")).toBeVisible();
  // Read available serials through the real API; browser actions perform every mutation.
  const data = await page.request.get("/api/inventory").then((r) => r.json());
  const serials = ["INV3", "CTRL"].map(
    (sku) =>
      data.assets.find((a: any) => a.sku === sku && a.status === "available")
        .serial,
  );
  // A permission prompt can finish after Stop camera; its late stream must be released.
  await page.evaluate(() => {
    // Replace the device object itself: WebKit can expose a fresh native wrapper on access.
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        new Promise((resolve) => {
          (window as any).finishCameraPermission = () =>
            resolve({
              getTracks: () => [
                {
                  stop: () => {
                    (window as any).cameraTrackStopped = true;
                  },
                },
              ],
            });
        }),
    });
  });
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  await expect(page.locator(".scanner-frame")).toBeVisible();
  await expect(
    page.getByText("Keep the whole barcode inside this box"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as any).finishCameraPermission),
    )
    .toBe("function");
  await page.locator(".scanner-preview").screenshot({
    path: `output/qa/${testInfo.project.name}-scanner-frame.png`,
  });
  await page.getByRole("button", { name: "Stop camera" }).click();
  await page.evaluate(() => (window as any).finishCameraPermission());
  await expect
    .poll(() => page.evaluate(() => (window as any).cameraTrackStopped))
    .toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    }),
  );
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  await expect(page.getByText(/Camera permission was denied/)).toBeVisible();
  await expect(page.locator(".scanner-preview")).toBeHidden();
  const blank = await sharp({
    create: { width: 600, height: 200, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Barcode photo", { exact: true })
    .setInputFiles({ name: "blank.png", mimeType: "image/png", buffer: blank });
  await expect(page.getByText(/No readable barcode found/)).toBeVisible();
  const encoded: any = {};
  JsBarcode(encoded, serials[0], { format: "CODE128" });
  const bars = encoded.encodings.map((e: any) => e.data).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bars.length * 3 + 60}" height="180"><rect width="100%" height="100%" fill="white"/>${[...bars].map((bit, i) => (bit === "1" ? `<rect x="${30 + i * 3}" y="20" width="3" height="140"/>` : "")).join("")}</svg>`;
  const label = await sharp(Buffer.from(svg)).png().toBuffer();
  if (testInfo.project.name === "chromium") {
    await page.evaluate(
      async (data) => {
        const c = document.createElement("canvas");
        c.width = 1920;
        c.height = 1080;
        const image = new Image();
        image.src = data;
        await image.decode();
        const ctx = c.getContext("2d")!;
        const draw = () => {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 1920, 1080);
          ctx.drawImage(
            image,
            (1920 - image.width) / 2,
            (1080 - image.height) / 2,
          );
        };
        draw();
        const stream = c.captureStream(10);
        (window as any).barcodeTestStream = stream;
        (window as any).barcodeTestTimer = setInterval(draw, 100);
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => stream,
        });
      },
      "data:image/png;base64," + label.toString("base64"),
    );
    await page.getByRole("button", { name: "Use camera", exact: true }).click();
    await expect(page.getByLabel("Device serial number")).toHaveValue(
      serials[0],
    );
    expect(
      await page.evaluate(() => {
        clearInterval((window as any).barcodeTestTimer);
        return (window as any).barcodeTestStream
          .getTracks()
          .every((t: MediaStreamTrack) => t.readyState === "ended");
      }),
    ).toBe(true);
  }
  await page.getByLabel("Barcode photo", { exact: true }).setInputFiles({
    name: "barcode.png",
    mimeType: "image/png",
    buffer: label,
  });
  await expect(page.getByLabel("Device serial number")).toHaveValue(serials[0]);
  await expect(
    page.getByText(
      `Barcode read: ${serials[0]}. Select Add serial to check and save it.`,
    ),
  ).toBeVisible();
  const stillAvailable = await page.request
    .get("/api/inventory")
    .then((r) => r.json());
  expect(
    stillAvailable.assets.find((a: any) => a.serial === serials[0]).status,
  ).toBe("available");
  for (const serial of serials) {
    await page.getByLabel("Device serial number").fill(serial);
    await page.getByRole("button", { name: "Add serial", exact: true }).click();
    await expect(page.getByLabel("Device serial number")).toHaveValue("");
  }
  await page.getByLabel("Device serial number").fill(serials[0]);
  await page.getByRole("button", { name: "Add serial", exact: true }).click();
  await expect(
    page.getByText("This serial has already been allocated or shipped."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm packing & dispatch" })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm customer delivery" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Asset passport", exact: true }).click();
  await expect(
    page.getByText("Coverage begins at delivery", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Packing & delivery" }).click();
  await page.getByRole("button", { name: "Confirm customer delivery" }).click();
  await expect(
    page.getByRole("heading", { name: "Delivered to customer" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Installation", exact: true }).click();
  await page.getByRole("button", { name: "Assign technician & time" }).click();
  await page.getByLabel("Technician", { exact: false }).selectOption({
    label:
      testInfo.project.name === "chromium"
        ? "Arjun Nair"
        : testInfo.project.name === "firefox"
          ? "Dev Patel"
          : "Ishaan Shah",
  });
  await page.getByLabel("Start date & time").fill("2030-01-10T09:00");
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Start installation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Installation evidence" }),
  ).toBeVisible();
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#537a88" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Choose photo")
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByText("Photo saved to the installation record."),
  ).toBeVisible();
  if (testInfo.project.name === "chromium") {
    const canvas = page.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 75, box.y + 25, { steps: 10 });
    await page.mouse.move(box.x + 60, box.y + 85, { steps: 10 });
    await page.mouse.move(box.x + 140, box.y + 50, { steps: 10 });
    await page.mouse.up();
    await page
      .getByRole("button", { name: "Save signature", exact: true })
      .click();
  } else {
    await page.getByText("Upload an existing signature instead").click();
    await page.getByLabel("Signature image (PNG)").setInputFiles({
      name: "signature.png",
      mimeType: "image/png",
      buffer: png,
    });
  }
  await expect(
    page.getByText("Signature saved to the installation record."),
  ).toBeVisible();
  await page.getByLabel("Measured generation").fill("2.4");
  await page
    .getByLabel("Homeowner / signer name")
    .fill("Synthetic QA Homeowner");
  for (const label of [
    "Mounting and fasteners checked",
    "Earthing & safety checks passed",
    "Wiring and protection verified",
    "Inverter and generation tested",
    "Operation explained to homeowner",
  ])
    await page.getByRole("checkbox", { name: label }).check();
  await page
    .getByRole("button", { name: "Complete installation & handover" })
    .click();
  await expect(page.getByText("Accepted by", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Synthetic QA Homeowner", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Synthetic QA Homeowner", { exact: true }),
  ).toBeVisible();
  expect(await page.locator(".evidence-list img").count()).toBe(2);
  await page.screenshot({
    path: `output/qa/${testInfo.project.name}-completed.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("public enquiry works without a session", async ({ page }, testInfo) => {
  await page.goto("/enquire");
  await page
    .getByLabel("Customer name")
    .fill(`Public QA ${testInfo.project.name}`);
  await page.getByLabel("Phone number").fill("9898989898");
  await page
    .getByLabel("Installation address")
    .fill("Synthetic public enquiry");
  await page.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enquiry received" }),
  ).toBeVisible();
});
