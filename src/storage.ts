import fs from 'node:fs/promises';
import path from 'node:path';
import { Tweet, TweetMedia } from './tweetTypes';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export const GENERAL_ID = 'general';

export const FOLDER_COLORS = [
  '#E5736B', '#E8A24A', '#D6C25A', '#5CC08B',
  '#4FB8C9', '#6C8CFF', '#A67CE8', '#E070A8',
];

// Built-in folder for unsorted posts. Not stored in folders.json.
const GENERAL_FOLDER: Folder = {
  id: GENERAL_ID,
  name: 'Inbox',
  description: 'Saved posts that are not in a folder yet',
  color: '#9AA3B2',
};

function postFolder(dataDir: string, tweetId: string): string {
  return path.join(dataDir, 'posts', tweetId);
}

function checkTweetId(tweetId: string): void {
  if (!/^\d+$/.test(tweetId)) {
    throw new Error('Invalid tweet id');
  }
}

async function fileUrlIfExists(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);
    return pathToFileURL(filePath).href;
  } catch {
    return null;
  }
}

export async function isSaved(dataDir: string, tweetId: string): Promise<boolean> {
  try {
    await fs.access(path.join(postFolder(dataDir, tweetId), 'post.json'));
    return true;
  } catch {
    return false;
  }
}

export async function saveTweet(dataDir: string, tweet: Tweet): Promise<string> {
  const folder = postFolder(dataDir, tweet.id);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'post.json'), JSON.stringify(tweet, null, 2), 'utf8');
  return folder;
}

// ---------- Folders ----------

// Only the user's own folders, as stored on disk (colour filled in for old ones).
async function readUserFolders(dataDir: string): Promise<Folder[]> {
  try {
    const text = await fs.readFile(path.join(dataDir, 'folders.json'), 'utf8');
    const stored = JSON.parse(text) as Partial<Folder>[];
    return stored.map((f, i) => ({
      id: String(f.id),
      name: f.name ?? 'Untitled',
      description: f.description ?? '',
      color: f.color ?? FOLDER_COLORS[i % FOLDER_COLORS.length],
    }));
  } catch {
    return [];
  }
}

// All folders, General first.
export async function listFolders(dataDir: string): Promise<Folder[]> {
  return [GENERAL_FOLDER, ...(await readUserFolders(dataDir))];
}

export async function addFolder(
  dataDir: string,
  name: string,
  description: string,
  color?: string,
): Promise<Folder[]> {
  const folders = await readUserFolders(dataDir);
  if (name) {
    const safeColor =
      color && FOLDER_COLORS.includes(color)
        ? color
        : FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
    folders.push({ id: randomUUID(), name, description, color: safeColor });
    await writeUserFolders(dataDir, folders);
  }
  return [GENERAL_FOLDER, ...folders];
}

async function writeUserFolders(dataDir: string, folders: Folder[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'folders.json'), JSON.stringify(folders, null, 2), 'utf8');
}

// Change a folder's name, description or colour. Inbox can't be edited.
export async function updateFolder(
  dataDir: string,
  id: string,
  changes: { name?: string; description?: string; color?: string },
): Promise<Folder[]> {
  const folders = await readUserFolders(dataDir);
  const folder = folders.find((f) => f.id === id);
  if (folder) {
    const name = changes.name?.trim();
    if (name) folder.name = name.slice(0, 60);
    if (changes.description !== undefined) folder.description = changes.description.trim().slice(0, 140);
    if (changes.color && FOLDER_COLORS.includes(changes.color)) folder.color = changes.color;
    await writeUserFolders(dataDir, folders);
  }
  return [GENERAL_FOLDER, ...folders];
}

// Delete a folder. Its posts go back to Inbox; no post is deleted.
export async function deleteFolder(dataDir: string, id: string): Promise<Folder[]> {
  const folders = await readUserFolders(dataDir);
  const remaining = folders.filter((f) => f.id !== id);
  if (remaining.length !== folders.length) {
    await writeUserFolders(dataDir, remaining);
    // Clear the old folder id from each post so nothing points at a deleted folder.
    let ids: string[] = [];
    try {
      ids = await fs.readdir(path.join(dataDir, 'posts'));
    } catch {
      // no posts yet
    }
    for (const postId of ids) {
      const folder = path.join(dataDir, 'posts', postId);
      const meta = await readMeta(folder);
      if (meta.folderId === id) {
        await fs.writeFile(
          path.join(folder, 'meta.json'),
          JSON.stringify({ ...meta, folderId: null }, null, 2),
          'utf8',
        );
      }
    }
  }
  return [GENERAL_FOLDER, ...remaining];
}

// ---------- Posts ----------

async function readMeta(folder: string): Promise<PostMeta> {
  try {
    const text = await fs.readFile(path.join(folder, 'meta.json'), 'utf8');
    return JSON.parse(text) as PostMeta;
  } catch {
    return { folderId: null, note: '' };
  }
}

export async function listPosts(dataDir: string): Promise<PostSummary[]> {
  const postsDir = path.join(dataDir, 'posts');
  let ids: string[];
  try {
    ids = await fs.readdir(postsDir);
  } catch {
    return [];
  }

  // A post whose folder was removed falls back to General.
  const folderIds = new Set((await listFolders(dataDir)).map((f) => f.id));

  const posts: PostSummary[] = [];
  for (const id of ids) {
    const folder = path.join(postsDir, id);
    const jsonPath = path.join(folder, 'post.json');
    try {
      const tweet = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as Tweet;
      const stat = await fs.stat(jsonPath);
      const meta = await readMeta(folder);
      const screenshotUrl = await fileUrlIfExists(path.join(folder, 'screenshot.png'));

      const firstPhoto = tweet.media.find((m) => m.type === 'photo' && m.localFile);
      const photoUrl = firstPhoto?.localFile
        ? pathToFileURL(path.join(folder, firstPhoto.localFile)).href
        : null;

      const folderId =
        meta.folderId && folderIds.has(meta.folderId) ? meta.folderId : GENERAL_ID;

      posts.push({
        id: tweet.id,
        authorHandle: tweet.authorHandle,
        authorName: tweet.authorName,
        text: tweet.text,
        createdAt: tweet.createdAt,
        savedAt: stat.mtime.toISOString(),
        screenshotUrl,
        thumbUrl: screenshotUrl ?? photoUrl,
        photoUrl,
        mediaTypes: tweet.media.map((m) => m.type),
        folderId,
        note: meta.note,
      });
    } catch {
      continue; // skip folders that aren't valid posts
    }
  }

  return posts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function listPostsInFolder(
  dataDir: string,
  folderId: string,
): Promise<PostSummary[]> {
  return (await listPosts(dataDir)).filter((p) => p.folderId === folderId);
}

export async function listFolderSummaries(dataDir: string): Promise<FolderSummary[]> {
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
        .filter((url): url is string => url !== null)
        .slice(0, 3),
    };
  });
}

function toMediaItems(postDir: string, media: TweetMedia[]): MediaItem[] {
  return media.map((m) => ({
    type: m.type,
    fileUrl: m.localFile ? pathToFileURL(path.join(postDir, m.localFile)).href : null,
    remoteUrl: m.url,
    width: m.width,
    height: m.height,
  }));
}

function toQuotedPost(postDir: string, tweet: Tweet): QuotedPost {
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

export async function getPost(dataDir: string, tweetId: string): Promise<PostDetail | null> {
  checkTweetId(tweetId);
  const folder = postFolder(dataDir, tweetId);
  const jsonPath = path.join(folder, 'post.json');
  try {
    const tweet = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as Tweet;
    const stat = await fs.stat(jsonPath);
    const meta = await readMeta(folder);
    const folderIds = new Set((await listFolders(dataDir)).map((f) => f.id));

    return {
      ...toQuotedPost(folder, tweet),
      replyingToId: tweet.replyingToId,
      quoted: tweet.quoted ? toQuotedPost(folder, tweet.quoted) : null,
      savedAt: stat.mtime.toISOString(),
      screenshotUrl: await fileUrlIfExists(path.join(folder, 'screenshot.png')),
      folderId: meta.folderId && folderIds.has(meta.folderId) ? meta.folderId : GENERAL_ID,
      note: meta.note,
    };
  } catch {
    return null;
  }
}

// ---------- Deleting posts (with a short undo window) ----------
// Deleting moves the post's folder to archive/.trash/<id>. Undo moves it back.
// Trash is emptied per post when the undo window ends, and fully on app start.

const trashDir = (dataDir: string) => path.join(dataDir, '.trash');

export async function trashPost(dataDir: string, tweetId: string): Promise<void> {
  checkTweetId(tweetId);
  const to = path.join(trashDir(dataDir), tweetId);
  await fs.mkdir(trashDir(dataDir), { recursive: true });
  await fs.rm(to, { recursive: true, force: true }); // leftover from an earlier delete
  await fs.rename(postFolder(dataDir, tweetId), to);
}

export async function restorePost(dataDir: string, tweetId: string): Promise<void> {
  checkTweetId(tweetId);
  const from = path.join(trashDir(dataDir), tweetId);
  const to = postFolder(dataDir, tweetId);
  if (await isSaved(dataDir, tweetId)) {
    // Saved again in the meantime: keep the newer copy.
    await fs.rm(from, { recursive: true, force: true });
    return;
  }
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rm(to, { recursive: true, force: true }); // a half-written folder without post.json
  await fs.rename(from, to);
}

// Permanently delete one trashed post, or everything in the trash.
export async function purgeTrash(dataDir: string, tweetId?: string): Promise<void> {
  if (tweetId !== undefined) {
    checkTweetId(tweetId);
    await fs.rm(path.join(trashDir(dataDir), tweetId), { recursive: true, force: true });
  } else {
    await fs.rm(trashDir(dataDir), { recursive: true, force: true });
  }
}

export async function savePostMeta(
  dataDir: string,
  tweetId: string,
  meta: PostMeta,
): Promise<void> {
  checkTweetId(tweetId);
  // General is stored as null so folders.json never needs a "general" entry.
  const clean: PostMeta = {
    folderId: meta.folderId && meta.folderId !== GENERAL_ID ? meta.folderId : null,
    note: meta.note,
  };
  const folder = postFolder(dataDir, tweetId);
  await fs.writeFile(path.join(folder, 'meta.json'), JSON.stringify(clean, null, 2), 'utf8');
}
