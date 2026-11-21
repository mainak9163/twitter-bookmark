import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fetchTweet, FetchError } from './fetcher';
import {
  addFolder,
  deleteFolder,
  getPost,
  isSaved,
  listFolders,
  listFolderSummaries,
  listPosts,
  listPostsInFolder,
  purgeTrash,
  restorePost,
  savePostMeta,
  trashPost,
  saveTweet,
  updateFolder,
} from './storage';
import { parseTweetLink } from './parseLink';
import { downloadMedia } from './media';
import { takeScreenshot } from './screenshot';
import { autoUpdater } from 'electron-updater';

// Keep data in %APPDATA%\twitter-bookmark (the package name). The installed app is
// named "Tweet Archive", which would otherwise move it to %APPDATA%\Tweet Archive
// and make every existing archive look empty after installing.
// TWEET_ARCHIVE_USER_DATA overrides it (test scripts use a scratch copy).
app.setPath(
  'userData',
  process.env.TWEET_ARCHIVE_USER_DATA || path.join(app.getPath('appData'), 'twitter-bookmark'),
);
if (process.platform === 'win32') app.setAppUserModelId('com.mainak9163.tweetarchive');

const archiveDir = () => path.join(app.getPath('userData'), 'archive');

// One running copy at a time: opening it again focuses the existing window
// instead of starting a second app that writes to the same files.
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) app.quit();
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

// ---------- Automatic updates (installed app only) ----------
// Checks GitHub Releases, downloads in the background, and installs when the
// user clicks "Restart" in the app, or otherwise the next time the app closes.
let readyUpdateVersion: string | null = null;

function setUpAutoUpdates(): void {
  if (!app.isPackaged) return; // `npm start` never updates itself
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', (info) => {
    readyUpdateVersion = info.version;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('update-ready', info.version);
  });
  // Offline, GitHub unreachable, no releases yet: try again later, never bother the user.
  autoUpdater.on('error', (error) => console.error('Update check failed:', error?.message ?? error));
  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

ipcMain.handle('pending-update', () => readyUpdateVersion);
ipcMain.on('install-update', () => {
  if (readyUpdateVersion) autoUpdater.quitAndInstall(true, true); // silent install, then reopen
});

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 520,
    title: 'Tweet Archive',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Links like "Open on X" go to the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
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
      return { ok: true, message: 'Already saved.', tweetId: parsed.tweetId, alreadySaved: true };
    }

    const tweet = await fetchTweet(parsed.tweetId);
    const folder = await saveTweet(dataDir, tweet);
    const { saved, total } = await downloadMedia(folder, tweet);
    await saveTweet(dataDir, tweet); // rewrite post.json with the local file paths
    const shot = await takeScreenshot(parsed.tweetId, path.join(folder, 'screenshot.png'));
    const problems: string[] = [];
    if (saved < total) problems.push(`${total - saved} of ${total} media files could not be downloaded`);
    if (!shot) problems.push('the screenshot failed');
    return {
      ok: true,
      message: problems.length ? `Saved, but ${problems.join(' and ')}.` : 'Saved.',
      tweetId: tweet.id,
    };
  } catch (error) {
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

ipcMain.handle(
  'update-folder',
  (_event, id: string, changes: { name?: string; description?: string; color?: string }) =>
    updateFolder(archiveDir(), id, changes),
);

ipcMain.handle('delete-folder', (_event, id: string) => deleteFolder(archiveDir(), id));

// The native window-control overlay sits above the page, so the renderer asks
// for it to be tinted to match its backdrops (panel, dialogs, photo viewer).
const TITLE_BAR_TINTS: Record<string, string> = { none: '#0e1014', dim: '#090a0e', dark: '#010101' };
ipcMain.on('set-title-bar-tint', (event, tint: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const color = TITLE_BAR_TINTS[tint];
  if (!win || !color || process.platform === 'darwin') return;
  win.setTitleBarOverlay({ color, symbolColor: tint === 'none' ? '#a4acba' : '#6f7889' });
});

ipcMain.handle('trash-post', (_event, tweetId: string) => trashPost(archiveDir(), tweetId));
ipcMain.handle('restore-post', (_event, tweetId: string) => restorePost(archiveDir(), tweetId));
ipcMain.handle('purge-trash', (_event, tweetId: string) => purgeTrash(archiveDir(), tweetId));

ipcMain.on('copy-text', (_event, text: string) => {
  if (typeof text === 'string' && text.length < 2000) clipboard.writeText(text);
});

ipcMain.handle('save-post-meta', (_event, tweetId: string, meta: PostMeta) =>
  savePostMeta(archiveDir(), tweetId, meta),
);

app.whenReady().then(() => {
  if (!isFirstInstance) return; // quitting: another copy is already open
  // Posts deleted last session whose undo window never finished.
  purgeTrash(archiveDir()).catch((error) => console.error('Could not empty trash:', error));
  createWindow();
  setUpAutoUpdates();

  // macOS: clicking the dock icon with no windows open should reopen one
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (macOS apps usually stay running)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});