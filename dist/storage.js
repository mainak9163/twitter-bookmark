"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSaved = isSaved;
exports.saveTweet = saveTweet;
exports.listPosts = listPosts;
exports.listFolders = listFolders;
exports.addFolder = addFolder;
exports.savePostMeta = savePostMeta;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const node_crypto_1 = require("node:crypto");
function postFolder(dataDir, tweetId) {
    return node_path_1.default.join(dataDir, 'posts', tweetId);
}
async function isSaved(dataDir, tweetId) {
    try {
        await promises_1.default.access(node_path_1.default.join(postFolder(dataDir, tweetId), 'post.json'));
        return true;
    }
    catch {
        return false;
    }
}
async function saveTweet(dataDir, tweet) {
    const folder = postFolder(dataDir, tweet.id);
    await promises_1.default.mkdir(folder, { recursive: true });
    await promises_1.default.writeFile(node_path_1.default.join(folder, 'post.json'), JSON.stringify(tweet, null, 2), 'utf8');
    return folder;
}
async function listPosts(dataDir) {
    const postsDir = node_path_1.default.join(dataDir, 'posts');
    let ids;
    try {
        ids = await promises_1.default.readdir(postsDir);
    }
    catch {
        return [];
    }
    const posts = [];
    for (const id of ids) {
        const folder = node_path_1.default.join(postsDir, id);
        const jsonPath = node_path_1.default.join(folder, 'post.json');
        try {
            const tweet = JSON.parse(await promises_1.default.readFile(jsonPath, 'utf8'));
            const stat = await promises_1.default.stat(jsonPath);
            const meta = await readMeta(folder);
            const shotPath = node_path_1.default.join(folder, 'screenshot.png');
            let screenshotUrl = null;
            try {
                await promises_1.default.access(shotPath);
                screenshotUrl = (0, node_url_1.pathToFileURL)(shotPath).href;
            }
            catch {
                // no screenshot for this post
            }
            posts.push({
                id: tweet.id,
                authorHandle: tweet.authorHandle,
                text: tweet.text,
                savedAt: stat.mtime.toISOString(),
                screenshotUrl,
                folderId: meta.folderId,
                note: meta.note,
            });
        }
        catch {
            continue; // skip folders that aren't valid posts
        }
    }
    return posts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
async function listFolders(dataDir) {
    try {
        const text = await promises_1.default.readFile(node_path_1.default.join(dataDir, 'folders.json'), 'utf8');
        return JSON.parse(text);
    }
    catch {
        return [];
    }
}
async function addFolder(dataDir, name, description) {
    const folders = await listFolders(dataDir);
    if (!name) {
        return folders;
    }
    folders.push({ id: (0, node_crypto_1.randomUUID)(), name, description });
    await promises_1.default.mkdir(dataDir, { recursive: true });
    await promises_1.default.writeFile(node_path_1.default.join(dataDir, 'folders.json'), JSON.stringify(folders, null, 2), 'utf8');
    return folders;
}
async function readMeta(folder) {
    try {
        const text = await promises_1.default.readFile(node_path_1.default.join(folder, 'meta.json'), 'utf8');
        return JSON.parse(text);
    }
    catch {
        return { folderId: null, note: '' };
    }
}
async function savePostMeta(dataDir, tweetId, meta) {
    if (!/^\d+$/.test(tweetId)) {
        throw new Error('Invalid tweet id');
    }
    const folder = postFolder(dataDir, tweetId);
    await promises_1.default.writeFile(node_path_1.default.join(folder, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
}
