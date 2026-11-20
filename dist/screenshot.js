"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.takeScreenshot = takeScreenshot;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const WIDTH = 600;
const TIMEOUT_MS = 30000;
const RENDER_WAIT_MS = 3000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function capture(tweetId, filePath) {
    const win = new electron_1.BrowserWindow({
        show: false,
        width: WIDTH,
        height: 1200,
        // no "persist:" prefix = temporary session, always logged out
        webPreferences: { partition: 'screenshot' },
    });
    try {
        await win.loadURL(`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`);
        await sleep(RENDER_WAIT_MS); // the tweet renders with JavaScript after the page loads
        const height = await win.webContents.executeJavaScript('document.documentElement.scrollHeight');
        win.setContentSize(WIDTH, Math.min(height, 4000));
        await sleep(500);
        const image = await win.webContents.capturePage();
        await promises_1.default.writeFile(filePath, image.toPNG());
    }
    finally {
        win.destroy();
    }
}
async function takeScreenshot(tweetId, filePath) {
    try {
        await Promise.race([
            capture(tweetId, filePath),
            new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timeout')), TIMEOUT_MS)),
        ]);
        return true;
    }
    catch {
        return false;
    }
}
