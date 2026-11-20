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
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
        },
    });
    win.loadFile(node_path_1.default.join(__dirname, '..', 'public', 'index.html'));
}
electron_1.ipcMain.handle('save-link', async (_event, url) => {
    const parsed = (0, parseLink_1.parseTweetLink)(url);
    if (!parsed) {
        return { ok: false, message: "That doesn't look like a tweet link." };
    }
    try {
        const dataDir = node_path_1.default.join(electron_1.app.getPath('userData'), 'archive');
        if (await (0, storage_1.isSaved)(dataDir, parsed.tweetId)) {
            return { ok: true, message: 'Already saved.' };
        }
        const tweet = await (0, fetcher_1.fetchTweet)(parsed.tweetId);
        const folder = await (0, storage_1.saveTweet)(dataDir, tweet);
        const { saved, total } = await (0, media_1.downloadMedia)(folder, tweet);
        await (0, storage_1.saveTweet)(dataDir, tweet); // rewrite post.json with the local file paths
        const shot = await (0, screenshot_1.takeScreenshot)(parsed.tweetId, node_path_1.default.join(folder, 'screenshot.png'));
        const mediaNote = total > 0 ? `, media ${saved}/${total}` : '';
        const shotNote = shot ? ', screenshot ok' : ', screenshot failed';
        return { ok: true, message: `Saved @${tweet.authorHandle}'s post${mediaNote}${shotNote}` };
    }
    catch (error) {
        if (error instanceof fetcher_1.FetchError) {
            return { ok: false, message: error.message };
        }
        console.error(error);
        return { ok: false, message: 'Unexpected error while fetching.' };
    }
});
electron_1.ipcMain.handle('list-posts', async () => {
    return (0, storage_1.listPosts)(node_path_1.default.join(electron_1.app.getPath('userData'), 'archive'));
});
const archiveDir = () => node_path_1.default.join(electron_1.app.getPath('userData'), 'archive');
electron_1.ipcMain.handle('list-folders', () => (0, storage_1.listFolders)(archiveDir()));
electron_1.ipcMain.handle('add-folder', (_event, name, description) => (0, storage_1.addFolder)(archiveDir(), name.trim(), description.trim()));
electron_1.ipcMain.handle('save-post-meta', (_event, tweetId, meta) => (0, storage_1.savePostMeta)(archiveDir(), tweetId, meta));
electron_1.app.whenReady().then(() => {
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
