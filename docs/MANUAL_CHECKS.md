# Demo accounts, notifications and the six remaining checks

Open http://127.0.0.1:3001 on the computer. Use the configured DEMO_PASSWORD. The customer portal is a separate ninth role; there are eight staff roles. Existing synthetic staff accounts are preserved. Customer demo accounts are lakshmi.customer@sunpower.local and sneha.customer@sunpower.local.

## Demonstrate the right customer receiving an update

1. Open the normal browser as support@sunpower.local. In a private browser window, sign in as lakshmi.customer@sunpower.local. Use separate windows so the accounts do not share a login cookie.
2. As support, open Repairs & warranty and add a new repair for Lakshmi Iyer. Select her existing installed system, enter a distinct demo complaint and save. If another request is already open, review the duplicate warning before creating genuinely separate work.
3. In Lakshmi's customer window, select Refresh updates or wait up to 15 seconds while the page is visible. Check that Repair request received appears and its SR number matches the support record. Open Your repair requests to see its current status.
4. Sign the staff window into coordinator@sunpower.local. Open Visits & scheduling, search an available slot for that repair and confirm the selected crew. Refresh the customer window: Your visits must show the correct date, time, status and technician names, and Your updates must show the appointment change.
5. To demonstrate completion, follow the existing technician diagnosis, approval, completion-photo and completion workflow. When the service invoice is created, the customer receives a New invoice update and sees itemized charges, including zero-priced covered components, under Your bills. Coverage and labour/callout charges still follow the saved diagnosis and approval rules.
6. Mark an update as read, reload, and verify that it remains read. Sign out and enter sneha.customer@sunpower.local: Lakshmi's projects, repairs, invoices and messages must not appear.

The recipient is selected by the saved project -> site -> customer identity. The account is linked to that customer ID; entering someone else's name or guessing a URL cannot grant access. Events and inbox records save in the same database transaction. Retries do not duplicate the originating event. No SMS, WhatsApp, email or background push provider is configured. Updates remain in the inbox when the customer is signed out and become visible after sign-in. The page refreshes automatically every 15 seconds while visible; Refresh updates is immediate. The latest 100 messages are shown. Customer confirmation and estimate approval remain recorded by support/coordinators after contacting the customer.

## Physical Android setup

The current app listens on the computer's loopback address. A phone cannot reach it by typing the computer's 127.0.0.1 address. For a private Android demo without publishing the app:

1. Enable Android Developer options and USB debugging, connect the phone by USB, and accept this computer's debugging prompt.
2. In desktop Chrome, open chrome://inspect/#devices and enable Discover USB devices. Select Port forwarding.
3. Add device port 3001 with destination localhost:3001, then enable forwarding. Open http://localhost:3001 in Chrome on the connected phone.
4. Sign in and allow camera access when requested. The loopback connection is a browser-trusted development context. This can demonstrate physical camera behaviour; it does not prove a separately deployed HTTPS address or native package.
5. After the demo, disconnect forwarding and disable USB debugging if no longer needed.

Source: [Chrome's USB port forwarding instructions](https://developer.chrome.com/docs/devtools/remote-debugging/local-server). [Camera access and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). For iPhone or wireless access, a separately configured trusted HTTPS address is still required; none is claimed to exist here.

## EVD-05 — camera denial and photo recovery

1. On the real phone, sign in as the technician assigned to an unfinished installation or repair visit. Start that assigned work and open its evidence section.
2. Deny camera permission when the phone/browser asks. Verify that the page remains usable and the installation/repair is not falsely completed.
3. Select Choose photo and choose a harmless test JPG/PNG from the gallery. For a repair, select the relevant visit/component when requested. Save it and wait for the saved message.
4. Reload. Confirm the saved photo is still visible on the same installation/repair. If the picker only offers the denied camera, or the saved photo disappears, record a failure with phone and browser details.
5. Separately test the packing scanner: deny Use camera, then choose Read barcode photo. It should fill the exact serial; only Add serial may allocate it. Automated denial and barcode-photo decoding are covered, but the physical evidence picker is still this manual gate.

## UXP-04 — real phone keyboard

1. Sign in as support, open New enquiry and enter a test customer name, telephone number and a long address with the software keyboard open.
2. Move through all fields; confirm the current field and its error message stay visible, the screen can scroll, and Create project can be reached without losing values.
3. Close the keyboard, switch between portrait and landscape, reopen it, then save the synthetic enquiry. Verify the saved customer name/address.
4. As an assigned technician, repeat with a long repair finding and a number field. Try back navigation with unsaved edits: the stay/discard warning must appear and Stay must preserve the values.

## UXP-05 — keyboard and screen reader

1. On Windows, enable Narrator with Ctrl+Windows+Enter. Use Tab/Shift+Tab to reach email, password and Sign in, and sign in as support without using the mouse.
2. Activate Skip to content. Open Customers & projects, search for a customer and open the record. Confirm each control has a useful spoken name and focus remains visibly indicated.
3. Open a dialog. Check that Tab stays inside it, Escape closes it, and focus returns to the opening control. Submit a required field empty and confirm its error is spoken or reachable with the screen reader.
4. Complete a synthetic enquiry, then navigate to a repair and return. Repeat the main navigation at 200% browser zoom; controls must remain reachable. Record the browser, screen reader and any unlabelled or trapped control. Automated accessibility scans are not a substitute for this check.

## UXP-06 — signed Android application

1. Check for a signed Android APK/AAB deliverable. None has been built in this project.
2. Keep this scenario BLOCKED. A working mobile browser or Add to Home Screen demonstration does not pass native installation/signing.
3. Once a native artifact is built, install it on an actual Android device, verify signing/upgrade behaviour, sign in, complete a repair/evidence workflow, deny and restore camera permission, restart and verify saved state. These steps cannot be completed against the current web-only artifact.

## UXP-07 — signed Windows application

1. Check for a signed Windows installer. None has been built in this project.
2. Keep this scenario BLOCKED. Desktop Chrome/Edge and a PWA shortcut do not establish native packaging/signing.
3. Once an installer exists, verify its publisher/signature, install and launch it, sign in, complete an installation/repair workflow, restart it, and test update/uninstall. Do not mark this passed using the browser alone.

## UXP-09 — physical barcode scan

1. Use a real phone with a trusted HTTPS app address for the exact acceptance gate. The private USB localhost setup above can provide useful physical-device evidence, but does not test the HTTPS deployment requirement.
2. Sign in as warehouse@sunpower.local. Open an order awaiting packing, record its required advance through the permitted sales/accounts role if needed, and reserve stock.
3. In Barcode labels, filter Available and the exact required product. Show the matching label on a second screen or print it at 100% scale. Already allocated demo labels must not be used as if they were new stock.
4. In Packing & delivery, select Use camera and allow access. Keep all bars and white space inside the white rectangle, avoid glare and hold steady. Check that the filled serial exactly matches the label, that the camera stops, and that no allocation has occurred yet.
5. Select Add serial. Confirm allocation, reload, and check it remains saved. Try that serial again: the app must reject duplicate allocation. Try an available serial of the wrong product and confirm rejection.
6. Stop the camera or navigate away while it is open. Confirm the phone's camera indicator turns off. Test Read barcode photo as the fallback.

For each manual test record PASS/FAIL/BLOCKED, phone/computer model, OS/browser, time, project/repair number, expected result, observed result and a screenshot where helpful. Do not convert any of the six to PASS without meeting its full gate.
