import fs from 'node:fs/promises';
import path from 'node:path';
import { Tweet, TweetMedia } from './tweetTypes';

const TIMEOUT_MS = 60000;

async function downloadOne(url: string, filePath: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
}

async function downloadList(folder: string, list: TweetMedia[], prefix: string): Promise<void> {
  for (const [i, media] of list.entries()) {
    const ext = path.extname(new URL(media.url).pathname);
    if (!ext || ext === '.m3u8') {
      media.localFile = null; // streaming playlists can't be saved as one file
      continue;
    }
    const fileName = `${prefix}${i + 1}${ext}`;
    try {
      await downloadOne(media.url, path.join(folder, 'media', fileName));
      media.localFile = `media/${fileName}`;
    } catch {
      media.localFile = null;
    }
  }
}

export async function downloadMedia(
  folder: string,
  tweet: Tweet,
): Promise<{ saved: number; total: number }> {
  const all = [...tweet.media, ...(tweet.quoted?.media ?? [])];
  if (all.length === 0) {
    return { saved: 0, total: 0 };
  }

  await fs.mkdir(path.join(folder, 'media'), { recursive: true });
  await downloadList(folder, tweet.media, '');
  if (tweet.quoted) {
    await downloadList(folder, tweet.quoted.media, 'quoted-');
  }

  return { saved: all.filter((m) => m.localFile).length, total: all.length };
}