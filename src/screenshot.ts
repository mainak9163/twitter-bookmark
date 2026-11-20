import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';

const WIDTH = 600;
const TIMEOUT_MS = 30000;
const RENDER_WAIT_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture(tweetId: string, filePath: string): Promise<void> {
  const win = new BrowserWindow({
    show: false,
    width: WIDTH,
    height: 1200,
    // no "persist:" prefix = temporary session, always logged out
    webPreferences: { partition: 'screenshot' },
  });

  try {
    await win.loadURL(`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`);
    await sleep(RENDER_WAIT_MS); // the tweet renders with JavaScript after the page loads

    const height: number = await win.webContents.executeJavaScript(
      'document.documentElement.scrollHeight',
    );
    win.setContentSize(WIDTH, Math.min(height, 4000));
    await sleep(500);

    const image = await win.webContents.capturePage();
    await fs.writeFile(filePath, image.toPNG());
  } finally {
    win.destroy();
  }
}

export async function takeScreenshot(tweetId: string, filePath: string): Promise<boolean> {
  try {
    await Promise.race([
      capture(tweetId, filePath),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('screenshot timeout')), TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}