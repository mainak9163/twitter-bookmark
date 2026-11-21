import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fetchTweet, FetchError } from './fetcher';
import {
  addFolder,
  getPost,
  isSaved,
  listFolders,
  listFolderSummaries,
  listPosts,
  listPostsInFolder,
  savePostMeta,
  saveTweet,
} from './storage';
import { parseTweetLink } from './parseLink';
import { downloadMedia } from './media';
import { takeScreenshot } from './screenshot';

const archiveDir = () => path.join(app.getPath('userData'), 'archive');

function createWindow(): void {
  const win = new BrowserWindow({
  width: 1000,
  height: 700,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
});

  win.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
}

ipcMain.handle('save-link', async (_event, url: string): Promise<SaveResult> => {
  const parsed = parseTweetLink(url);
  if (!parsed) {
    return { ok: false, message: "That doesn't look like a tweet link." };
  }

  try {
    const dataDir = archiveDir();

    if (await isSaved(dataDir, parsed.tweetId)) {
      return { ok: true, message: 'Already saved.' };
    }

        const tweet = await fetchTweet(parsed.tweetId);
    const folder = await saveTweet(dataDir, tweet);
    const { saved, total } = await downloadMedia(folder, tweet);
    await saveTweet(dataDir, tweet); // rewrite post.json with the local file paths
        const shot = await takeScreenshot(parsed.tweetId, path.join(folder, 'screenshot.png'));
    const mediaNote = total > 0 ? `, media ${saved}/${total}` : '';
    const shotNote = shot ? ', screenshot ok' : ', screenshot failed';
    return { ok: true, message: `Saved @${tweet.authorHandle}'s post${mediaNote}${shotNote}` };
  }catch (error) {
    if (error instanceof FetchError) {
      return { ok: false, message: error.message };
    }
    console.error(error);
    return { ok: false, message: 'Unexpected error while fetching.' };
  }
});

ipcMain.handle('list-posts', () => listPosts(archiveDir()));

ipcMain.handle('list-folders', () => listFolders(archiveDir()));

ipcMain.handle('list-folder-summaries', () => listFolderSummaries(archiveDir()));

ipcMain.handle('list-posts-in-folder', (_event, folderId: string) =>
  listPostsInFolder(archiveDir(), folderId),
);

ipcMain.handle('get-post', (_event, tweetId: string) => getPost(archiveDir(), tweetId));

ipcMain.handle('add-folder', (_event, name: string, description: string, color?: string) =>
  addFolder(archiveDir(), name.trim(), description.trim(), color),
);

ipcMain.handle('save-post-meta', (_event, tweetId: string, meta: PostMeta) =>
  savePostMeta(archiveDir(), tweetId, meta),
);

app.whenReady().then(() => {
  createWindow();

  // macOS: clicking the dock icon with no windows open should reopen one
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (macOS apps usually stay running)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});