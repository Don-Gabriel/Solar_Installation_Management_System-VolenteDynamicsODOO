const { app, BrowserWindow, Menu, dialog, session } = require("electron");
const server = process.env.SUNPOWER_SERVER_URL || "http://127.0.0.1:3001";
const origin = new URL(server).origin;
if (
  !/^https:/.test(server) &&
  !["localhost", "127.0.0.1"].includes(new URL(server).hostname)
) {
  throw new Error("Use HTTPS for a server outside this computer.");
}
function trusted(url) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 390,
    minHeight: 600,
    title: "SunPower Operations",
    backgroundColor: "#f6f8f8",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, requestingOrigin) =>
      contents === win.webContents &&
      permission === "media" &&
      trusted(requestingOrigin),
  );
  session.defaultSession.setPermissionRequestHandler(
    async (contents, permission, callback, details) => {
      if (
        contents !== win.webContents ||
        permission !== "media" ||
        !trusted(details.requestingUrl) ||
        details.mediaTypes?.includes("audio")
      )
        return callback(false);
      const answer = await dialog.showMessageBox(win, {
        type: "question",
        buttons: ["Allow camera", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message:
          "Allow SunPower to use your camera for barcode scanning and work photos?",
      });
      callback(answer.response === 0);
    },
  );
  win.webContents.on("will-navigate", (event, url) => {
    if (!trusted(url)) event.preventDefault();
  });
  win.webContents.on("will-redirect", (event, url) => {
    if (!trusted(url)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (trusted(url)) win.loadURL(url);
    return { action: "deny" };
  });
  win.webContents.on(
    "did-fail-load",
    (_event, code, _description, url, mainFrame) => {
      if (mainFrame && code !== -3)
        dialog.showMessageBox(win, {
          type: "warning",
          message: "SunPower could not connect",
          detail: `Keep the SunPower server running at ${origin}, then choose App → Refresh.`,
          buttons: ["OK"],
        });
    },
  );
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "App",
        submenu: [
          {
            label: "Back",
            accelerator: "Alt+Left",
            click: () => {
              if (win.webContents.navigationHistory.canGoBack())
                win.webContents.navigationHistory.goBack();
            },
          },
          {
            label: "Refresh",
            accelerator: "CmdOrCtrl+R",
            click: () => win.webContents.reload(),
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "togglefullscreen" },
        ],
      },
    ]),
  );
  win.loadURL(server);
});
app.on("window-all-closed", () => app.quit());
