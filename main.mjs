import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// directory to store tracks
const tracksDir = path.join(app.getPath("userData"), "lightTracks");

function ensureTracksDir() {
    try {
        fs.mkdirSync(tracksDir, { recursive: true });
    } catch (e) {
        console.error("Unable to create tracks directory:", e);
    }
}

// IPC handlers
ipcMain.handle("lightfs-save-track", async (e, name, data) => {
    ensureTracksDir();
    const file = path.join(tracksDir, `${name}.json`);
    await fs.promises.writeFile(file, JSON.stringify(data), "utf-8");
});

ipcMain.handle("lightfs-load-tracks", async () => {
    ensureTracksDir();
    const files = (await fs.promises.readdir(tracksDir)).filter((f) =>
        f.endsWith(".json")
    );
    const result = [];
    for (const f of files) {
        try {
            const raw = await fs.promises.readFile(
                path.join(tracksDir, f),
                "utf-8"
            );
            result.push({ name: path.parse(f).name, data: JSON.parse(raw) });
        } catch (err) {
            console.warn("Failed to read track", f, err);
        }
    }
    return result;
});

ipcMain.handle("lightfs-delete-track", async (e, name) => {
    const file = path.join(tracksDir, `${name}.json`);
    try {
        await fs.promises.unlink(file);
    } catch {}
});

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            enableRemoteModule: false,
        },
    });

    win.loadFile(path.join(__dirname, "index.html"));
    win.webContents.openDevTools(); // Remove this line for production
};

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
