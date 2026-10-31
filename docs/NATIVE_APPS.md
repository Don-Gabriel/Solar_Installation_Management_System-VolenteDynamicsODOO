# Windows and Android demo apps

These clients use the existing React interface and Fastify/PostgreSQL server. They share the same users, stock, appointments, invoices and private images. They require a running server; the database is not bundled into either client.

## Windows

Open `SunPower-Windows-0.1.0.exe` from Downloads. It is a portable 64-bit Windows application and connects to `http://127.0.0.1:3001`. Keep the server running on this computer. No installation or administrator privileges are required. A production publisher certificate is not configured, so this executable is unsigned.

The App menu contains Back, Refresh and Quit. The shared interface also provides Back and Refresh. A different HTTPS server can be configured with the `SUNPOWER_SERVER_URL` environment variable before launching. The Electron renderer has Node access disabled, context isolation and sandboxing enabled, and navigation restricted to the configured origin. Camera requests require confirmation; microphone access is not granted.

Build: `npm ci --prefix native/windows`, then `npm run package --prefix native/windows`. The packaged executable is written to `output/native/windows`. Verify the packaged payload with `node scripts/check-native-windows.mjs` while the server is running.

## Android

`SunPower-Android-demo.apk` in Downloads is an installable development build, signed with a local demo key. It supports Android 8 and later. It is not a Play Store release or an iPhone application. The app includes camera permission handling, an image picker, back navigation and server settings. Development builds enable WebView debugging; a production build must disable debugging and use an organization-controlled signing key.

For this local demonstration:

1. Keep the Windows server running on port 3001.
2. Enable Developer options and USB debugging on the Android phone, connect it by USB, and accept the computer authorization prompt.
3. Run `adb devices` and choose the intended device. Run `adb -s DEVICE_SERIAL reverse tcp:3001 tcp:3001`.
4. Copy the APK onto the phone and install it, or run `adb -s DEVICE_SERIAL install -r SunPower-Android-demo.apk` from its folder.
5. Open SunPower. The default server is `http://localhost:3001`, which reaches the computer through USB forwarding. Sign in using a demo account.
6. For a wireless deployment, select Server and enter a trusted HTTPS server URL. Add that origin to the server's `APP_ORIGINS` and use secure cookies for HTTPS. The app does not bypass certificate errors or allow unencrypted remote servers.
7. Use a test barcode and a harmless image to check the physical camera, gallery picker and permission denial. Verify keyboard visibility on the actual phone.

Rebuild using `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1`. Set `ANDROID_HOME` if needed. This script uses Android platform 36.1, build tools 36.1.0 and JDK 17 or later directly, avoiding the local Gradle daemon connection failure. The Android Studio/Gradle project is also included. The debug key stays in ignored local output; retain it to install upgrades over this demo. Verify with `scripts/check-native-android.mjs` after installing on the QA emulator and enabling port forwarding.

## Demo users, suggestions and evidence

Sign in as `admin@sunpower.local` using the shared demo password. Click Administrator at the top right. Filter by role or search a name/email and choose an account. This capability is restricted to an administrator-originated session in non-production demo mode. Customer and technician accounts signed in directly cannot impersonate anyone. Switching rotates the session and clears previous-user drafts and cached data; unsaved work requires an explicit discard choice.

Scheduling suggests an earliest qualified slot within the selected window and selects a qualified lead with the lowest booked workload. Repair visits default to one technician selected by name; larger crews remain available. Installation assignments suggest a technician and time too. Review the duration, required skill and customer availability before confirming. The server rechecks conflicts, skills, leave, working days and travel buffers when saving. Measurements, findings, approvals, signatures and actual bank references are never fabricated. Explicit demo stock presets generate a unique sample receipt reference and appropriate serial count without saving until confirmed.

Back follows actual navigation history, including visited project tabs. Refresh updates server data while retaining unsaved entries. A current signature can be deleted and drawn again before completion; signatures attached to completed visits remain protected.

Photos and signatures are private files under the configured `UPLOAD_DIR`. On the restored local demo this is `data/uploads/solar_demo_20261031121523`. PostgreSQL stores their ownership, random filename, MIME type, size, hash and related job/visit/component, rather than the image bytes. Images are decoded and normalized, limited to 8 MB and 20 megapixels, and served through an authenticated endpoint with role/assignment checks. Removing a signature removes its database record and attempts to delete its file; failed physical cleanup is logged and the file is no longer available through the API. Back up both the database and upload directory.

Customer notifications are persisted in the customer inbox and refresh every 15 seconds. SMS, email and operating-system push notifications are not connected. Switch to the specific customer's account to show their appointment, repair and billing updates. Other customers cannot see those records.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [Android signing tools](https://developer.android.com/tools/apksigner).
