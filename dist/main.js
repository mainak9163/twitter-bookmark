"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const fetcher_1 = require("./fetcher");
const storage_1 = require("./storage");
const parseLink_1 = require("./parseLink");
const media_1 = require("./media");
const screenshot_1 = require("./screenshot");
const archiveDir = () => node_path_1.default.join(electron_1.app.getPath('userData'), 'archive');
function createWindow() {
    const isMac = process.platform === 'darwin';
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 720,
        minHeight: 520,
        title: 'Tweet Archive',
        icon: node_path_1.default.join(__dirname, '..', 'public', 'icon.png'),
        // Matches --bg, so the window opens dark straight away (no white flash). It's shown
        // immediately rather than on 'ready-to-show': a slow first load then looks like
        // "loading", not like the app failed to open.
        backgroundColor: '#0e1014',
        // No stock title bar or File/Edit/View menu: the app's own top bar is the title bar.
        // Windows/Linux draw the native min/max/close buttons over it; macOS keeps its traffic lights.
        titleBarStyle: 'hidden',
        ...(isMac
            ? { trafficLightPosition: { x: 18, y: 18 } }
            : { titleBarOverlay: { color: '#0e1014', symbolColor: '#a4acba', height: 52 } }),
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
        },
    });
    // Links like "Open on X" go to the user's browser, never inside the app.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://') || url.startsWith('http://')) {
            electron_1.shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://'))
            event.preventDefault();
    });
    win.loadFile(node_path_1.default.join(__dirname, '..', 'public', 'index.html'));
}
electron_1.ipcMain.handle('save-link', async (_event, url) => {
    const parsed = (0, parseLink_1.parseTweetLink)(url);
    if (!parsed) {
        return { ok: false, message: "That doesn't look like a tweet link." };
    }
    try {
        const dataDir = archiveDir();
        if (await (0, storage_1.isSaved)(dataDir, parsed.tweetId)) {
            return { ok: true, message: 'Already saved.', tweetId: parsed.tweetId, alreadySaved: true };
        }
        const tweet = await (0, fetcher_1.fetchTweet)(parsed.tweetId);
        const folder = await (0, storage_1.saveTweet)(dataDir, tweet);
        const { saved, total } = await (0, media_1.downloadMedia)(folder, tweet);
        await (0, storage_1.saveTweet)(dataDir, tweet); // rewrite post.json with the local file paths
        const shot = await (0, screenshot_1.takeScreenshot)(parsed.tweetId, node_path_1.default.join(folder, 'screenshot.png'));
        const problems = [];
        if (saved < total)
            problems.push(`${total - saved} of ${total} media files could not be downloaded`);
        if (!shot)
            problems.push('the screenshot failed');
        return {
            ok: true,
            message: problems.length ? `Saved, but ${problems.join(' and ')}.` : 'Saved.',
            tweetId: tweet.id,
        };
    }
    catch (error) {
        if (error instanceof fetcher_1.FetchError) {
            return { ok: false, message: error.message };
        }
        console.error(error);
        return { ok: false, message: 'Unexpected error while fetching.' };
    }
});
electron_1.ipcMain.handle('list-posts', () => (0, storage_1.listPosts)(archiveDir()));
electron_1.ipcMain.handle('list-folders', () => (0, storage_1.listFolders)(archiveDir()));
electron_1.ipcMain.handle('list-folder-summaries', () => (0, storage_1.listFolderSummaries)(archiveDir()));
electron_1.ipcMain.handle('list-posts-in-folder', (_event, folderId) => (0, storage_1.listPostsInFolder)(archiveDir(), folderId));
electron_1.ipcMain.handle('get-post', (_event, tweetId) => (0, storage_1.getPost)(archiveDir(), tweetId));
electron_1.ipcMain.handle('add-folder', (_event, name, description, color) => (0, storage_1.addFolder)(archiveDir(), name.trim(), description.trim(), color));
electron_1.ipcMain.handle('update-folder', (_event, id, changes) => (0, storage_1.updateFolder)(archiveDir(), id, changes));
electron_1.ipcMain.handle('delete-folder', (_event, id) => (0, storage_1.deleteFolder)(archiveDir(), id));
// The native window-control overlay sits above the page, so the renderer asks
// for it to be tinted to match its backdrops (panel, dialogs, photo viewer).
const TITLE_BAR_TINTS = { none: '#0e1014', dim: '#090a0e', dark: '#010101' };
electron_1.ipcMain.on('set-title-bar-tint', (event, tint) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender);
    const color = TITLE_BAR_TINTS[tint];
    if (!win || !color || process.platform === 'darwin')
        return;
    win.setTitleBarOverlay({ color, symbolColor: tint === 'none' ? '#a4acba' : '#6f7889' });
});
electron_1.ipcMain.handle('trash-post', (_event, tweetId) => (0, storage_1.trashPost)(archiveDir(), tweetId));
electron_1.ipcMain.handle('restore-post', (_event, tweetId) => (0, storage_1.restorePost)(archiveDir(), tweetId));
electron_1.ipcMain.handle('purge-trash', (_event, tweetId) => (0, storage_1.purgeTrash)(archiveDir(), tweetId));
electron_1.ipcMain.on('copy-text', (_event, text) => {
    if (typeof text === 'string' && text.length < 2000)
        electron_1.clipboard.writeText(text);
});
electron_1.ipcMain.handle('save-post-meta', (_event, tweetId, meta) => (0, storage_1.savePostMeta)(archiveDir(), tweetId, meta));
electron_1.app.whenReady().then(() => {
    // Posts deleted last session whose undo window never finished.
    (0, storage_1.purgeTrash)(archiveDir()).catch((error) => console.error('Could not empty trash:', error));
    createWindow();
    // macOS: clicking the dock icon with no windows open should reopen one
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
// Quit when all windows are closed (macOS apps usually stay running)
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
