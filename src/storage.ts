import fs from 'node:fs/promises';
import path from 'node:path';
import { Tweet } from './tweetTypes';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

function postFolder(dataDir: string, tweetId: string): string {
  return path.join(dataDir, 'posts', tweetId);
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

export async function listPosts(dataDir: string): Promise<PostSummary[]> {
  const postsDir = path.join(dataDir, 'posts');
  let ids: string[];
  try {
    ids = await fs.readdir(postsDir);
  } catch {
    return [];
  }

  const posts: PostSummary[] = [];
  for (const id of ids) {
    const folder = path.join(postsDir, id);
    const jsonPath = path.join(folder, 'post.json');
    try {
      const tweet = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as Tweet;
      const stat = await fs.stat(jsonPath);
      const meta = await readMeta(folder);
      const shotPath = path.join(folder, 'screenshot.png');
      let screenshotUrl: string | null = null;
      try {
        await fs.access(shotPath);
        screenshotUrl = pathToFileURL(shotPath).href;
      } catch {
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
    } catch {
      continue; // skip folders that aren't valid posts
    }
  }

  return posts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function listFolders(dataDir: string): Promise<Folder[]> {
  try {
    const text = await fs.readFile(path.join(dataDir, 'folders.json'), 'utf8');
    return JSON.parse(text) as Folder[];
  } catch {
    return [];
  }
}

export async function addFolder(
  dataDir: string,
  name: string,
  description: string,
): Promise<Folder[]> {
  const folders = await listFolders(dataDir);
  if (!name) {
    return folders;
  }
  folders.push({ id: randomUUID(), name, description });
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'folders.json'), JSON.stringify(folders, null, 2), 'utf8');
  return folders;
}

async function readMeta(folder: string): Promise<PostMeta> {
  try {
    const text = await fs.readFile(path.join(folder, 'meta.json'), 'utf8');
    return JSON.parse(text) as PostMeta;
  } catch {
    return { folderId: null, note: '' };
  }
}

export async function savePostMeta(
  dataDir: string,
  tweetId: string,
  meta: PostMeta,
): Promise<void> {
  if (!/^\d+$/.test(tweetId)) {
    throw new Error('Invalid tweet id');
  }
  const folder = postFolder(dataDir, tweetId);
  await fs.writeFile(path.join(folder, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
}