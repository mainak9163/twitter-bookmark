import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  platform: process.platform, // for title-bar spacing (macOS traffic lights sit on the left)
  setTitleBarTint: (tint: 'none' | 'dim' | 'dark'): void => ipcRenderer.send('set-title-bar-tint', tint),
  saveLink: (url: string): Promise<SaveResult> => ipcRenderer.invoke('save-link', url),
  listPosts: (): Promise<PostSummary[]> => ipcRenderer.invoke('list-posts'),
  listFolders: (): Promise<Folder[]> => ipcRenderer.invoke('list-folders'),
  listFolderSummaries: (): Promise<FolderSummary[]> =>
    ipcRenderer.invoke('list-folder-summaries'),
  listPostsInFolder: (folderId: string): Promise<PostSummary[]> =>
    ipcRenderer.invoke('list-posts-in-folder', folderId),
  getPost: (tweetId: string): Promise<PostDetail | null> =>
    ipcRenderer.invoke('get-post', tweetId),
  addFolder: (name: string, description: string, color?: string): Promise<Folder[]> =>
    ipcRenderer.invoke('add-folder', name, description, color),
  updateFolder: (id: string, changes: FolderChanges): Promise<Folder[]> =>
    ipcRenderer.invoke('update-folder', id, changes),
  deleteFolder: (id: string): Promise<Folder[]> => ipcRenderer.invoke('delete-folder', id),
  trashPost: (tweetId: string): Promise<void> => ipcRenderer.invoke('trash-post', tweetId),
  restorePost: (tweetId: string): Promise<void> => ipcRenderer.invoke('restore-post', tweetId),
  purgeTrash: (tweetId: string): Promise<void> => ipcRenderer.invoke('purge-trash', tweetId),
  copyText: (text: string): void => ipcRenderer.send('copy-text', text),
  // Automatic updates: told when a new version has downloaded; installUpdate restarts into it.
  onUpdateReady: (callback: (version: string) => void): void => {
    ipcRenderer.on('update-ready', (_event, version: string) => callback(version));
  },
  pendingUpdate: (): Promise<string | null> => ipcRenderer.invoke('pending-update'),
  installUpdate: (): void => ipcRenderer.send('install-update'),
  savePostMeta: (tweetId: string, meta: PostMeta): Promise<void> =>
    ipcRenderer.invoke('save-post-meta', tweetId, meta),
});
