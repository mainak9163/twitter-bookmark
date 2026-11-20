import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
      listPosts: (): Promise<PostSummary[]> => ipcRenderer.invoke('list-posts'),
  saveLink: (url: string): Promise<SaveResult> =>
    ipcRenderer.invoke('save-link', url),
  listFolders: (): Promise<Folder[]> => ipcRenderer.invoke('list-folders'),
  addFolder: (name: string, description: string): Promise<Folder[]> =>
    ipcRenderer.invoke('add-folder', name, description),
  savePostMeta: (tweetId: string, meta: PostMeta): Promise<void> =>
    ipcRenderer.invoke('save-post-meta', tweetId, meta),
});