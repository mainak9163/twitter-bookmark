"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadMedia = downloadMedia;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const TIMEOUT_MS = 60000;
async function downloadOne(url, filePath) {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    await promises_1.default.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
}
async function downloadList(folder, list, prefix) {
    for (const [i, media] of list.entries()) {
        const ext = node_path_1.default.extname(new URL(media.url).pathname);
        if (!ext || ext === '.m3u8') {
            media.localFile = null; // streaming playlists can't be saved as one file
            continue;
        }
        const fileName = `${prefix}${i + 1}${ext}`;
        try {
            await downloadOne(media.url, node_path_1.default.join(folder, 'media', fileName));
            media.localFile = `media/${fileName}`;
        }
        catch {
            media.localFile = null;
        }
    }
}
async function downloadMedia(folder, tweet) {
    const all = [...tweet.media, ...(tweet.quoted?.media ?? [])];
    if (all.length === 0) {
        return { saved: 0, total: 0 };
    }
    await promises_1.default.mkdir(node_path_1.default.join(folder, 'media'), { recursive: true });
    await downloadList(folder, tweet.media, '');
    if (tweet.quoted) {
        await downloadList(folder, tweet.quoted.media, 'quoted-');
    }
    return { saved: all.filter((m) => m.localFile).length, total: all.length };
}
