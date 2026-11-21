"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOLDER_COLORS = exports.GENERAL_ID = void 0;
exports.isSaved = isSaved;
exports.saveTweet = saveTweet;
exports.listFolders = listFolders;
exports.addFolder = addFolder;
exports.listPosts = listPosts;
exports.listPostsInFolder = listPostsInFolder;
exports.listFolderSummaries = listFolderSummaries;
exports.getPost = getPost;
exports.savePostMeta = savePostMeta;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const node_crypto_1 = require("node:crypto");
exports.GENERAL_ID = 'general';
exports.FOLDER_COLORS = [
    '#E5736B', '#E8A24A', '#D6C25A', '#5CC08B',
    '#4FB8C9', '#6C8CFF', '#A67CE8', '#E070A8',
];
// Built-in folder for unsorted posts. Not stored in folders.json.
const GENERAL_FOLDER = {
    id: exports.GENERAL_ID,
    name: 'General',
    description: 'Posts not sorted into a folder yet',
    color: '#9AA3B2',
};
function postFolder(dataDir, tweetId) {
    return node_path_1.default.join(dataDir, 'posts', tweetId);
}
function checkTweetId(tweetId) {
    if (!/^\d+$/.test(tweetId)) {
        throw new Error('Invalid tweet id');
    }
}
async function fileUrlIfExists(filePath) {
    try {
        await promises_1.default.access(filePath);
        return (0, node_url_1.pathToFileURL)(filePath).href;
    }
    catch {
        return null;
    }
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
// ---------- Folders ----------
// Only the user's own folders, as stored on disk (colour filled in for old ones).
async function readUserFolders(dataDir) {
    try {
        const text = await promises_1.default.readFile(node_path_1.default.join(dataDir, 'folders.json'), 'utf8');
        const stored = JSON.parse(text);
        return stored.map((f, i) => ({
            id: String(f.id),
            name: f.name ?? 'Untitled',
            description: f.description ?? '',
            color: f.color ?? exports.FOLDER_COLORS[i % exports.FOLDER_COLORS.length],
        }));
    }
    catch {
        return [];
    }
}
// All folders, General first.
async function listFolders(dataDir) {
    return [GENERAL_FOLDER, ...(await readUserFolders(dataDir))];
}
async function addFolder(dataDir, name, description, color) {
    const folders = await readUserFolders(dataDir);
    if (name) {
        const safeColor = color && exports.FOLDER_COLORS.includes(color)
            ? color
            : exports.FOLDER_COLORS[folders.length % exports.FOLDER_COLORS.length];
        folders.push({ id: (0, node_crypto_1.randomUUID)(), name, description, color: safeColor });
        await promises_1.default.mkdir(dataDir, { recursive: true });
        await promises_1.default.writeFile(node_path_1.default.join(dataDir, 'folders.json'), JSON.stringify(folders, null, 2), 'utf8');
    }
    return [GENERAL_FOLDER, ...folders];
}
// ---------- Posts ----------
async function readMeta(folder) {
    try {
        const text = await promises_1.default.readFile(node_path_1.default.join(folder, 'meta.json'), 'utf8');
        return JSON.parse(text);
    }
    catch {
        return { folderId: null, note: '' };
    }
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
    // A post whose folder was removed falls back to General.
    const folderIds = new Set((await listFolders(dataDir)).map((f) => f.id));
    const posts = [];
    for (const id of ids) {
        const folder = node_path_1.default.join(postsDir, id);
        const jsonPath = node_path_1.default.join(folder, 'post.json');
        try {
            const tweet = JSON.parse(await promises_1.default.readFile(jsonPath, 'utf8'));
            const stat = await promises_1.default.stat(jsonPath);
            const meta = await readMeta(folder);
            const screenshotUrl = await fileUrlIfExists(node_path_1.default.join(folder, 'screenshot.png'));
            const firstPhoto = tweet.media.find((m) => m.type === 'photo' && m.localFile);
            const photoUrl = firstPhoto?.localFile
                ? (0, node_url_1.pathToFileURL)(node_path_1.default.join(folder, firstPhoto.localFile)).href
                : null;
            const folderId = meta.folderId && folderIds.has(meta.folderId) ? meta.folderId : exports.GENERAL_ID;
            posts.push({
                id: tweet.id,
                authorHandle: tweet.authorHandle,
                authorName: tweet.authorName,
                text: tweet.text,
                createdAt: tweet.createdAt,
                savedAt: stat.mtime.toISOString(),
                screenshotUrl,
                thumbUrl: screenshotUrl ?? photoUrl,
                folderId,
                note: meta.note,
            });
        }
        catch {
            continue; // skip folders that aren't valid posts
        }
    }
    return posts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
async function listPostsInFolder(dataDir, folderId) {
    return (await listPosts(dataDir)).filter((p) => p.folderId === folderId);
}
async function listFolderSummaries(dataDir) {
    const folders = await listFolders(dataDir);
    const posts = await listPosts(dataDir); // newest first
    return folders.map((folder) => {
        const inFolder = posts.filter((p) => p.folderId === folder.id);
        return {
            ...folder,
            count: inFolder.length,
            lastSavedAt: inFolder[0]?.savedAt ?? null,
            thumbs: inFolder
                .map((p) => p.thumbUrl)
                .filter((url) => url !== null)
                .slice(0, 3),
        };
    });
}
function toMediaItems(postDir, media) {
    return media.map((m) => ({
        type: m.type,
        fileUrl: m.localFile ? (0, node_url_1.pathToFileURL)(node_path_1.default.join(postDir, m.localFile)).href : null,
        remoteUrl: m.url,
        width: m.width,
        height: m.height,
    }));
}
function toQuotedPost(postDir, tweet) {
    return {
        id: tweet.id,
        url: tweet.url,
        text: tweet.text,
        createdAt: tweet.createdAt,
        authorHandle: tweet.authorHandle,
        authorName: tweet.authorName,
        media: toMediaItems(postDir, tweet.media),
    };
}
async function getPost(dataDir, tweetId) {
    checkTweetId(tweetId);
    const folder = postFolder(dataDir, tweetId);
    const jsonPath = node_path_1.default.join(folder, 'post.json');
    try {
        const tweet = JSON.parse(await promises_1.default.readFile(jsonPath, 'utf8'));
        const stat = await promises_1.default.stat(jsonPath);
        const meta = await readMeta(folder);
        const folderIds = new Set((await listFolders(dataDir)).map((f) => f.id));
        return {
            ...toQuotedPost(folder, tweet),
            replyingToId: tweet.replyingToId,
            quoted: tweet.quoted ? toQuotedPost(folder, tweet.quoted) : null,
            savedAt: stat.mtime.toISOString(),
            screenshotUrl: await fileUrlIfExists(node_path_1.default.join(folder, 'screenshot.png')),
            folderId: meta.folderId && folderIds.has(meta.folderId) ? meta.folderId : exports.GENERAL_ID,
            note: meta.note,
        };
    }
    catch {
        return null;
    }
}
async function savePostMeta(dataDir, tweetId, meta) {
    checkTweetId(tweetId);
    // General is stored as null so folders.json never needs a "general" entry.
    const clean = {
        folderId: meta.folderId && meta.folderId !== exports.GENERAL_ID ? meta.folderId : null,
        note: meta.note,
    };
    const folder = postFolder(dataDir, tweetId);
    await promises_1.default.writeFile(node_path_1.default.join(folder, 'meta.json'), JSON.stringify(clean, null, 2), 'utf8');
}
