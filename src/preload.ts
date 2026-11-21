import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
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
  savePostMeta: (tweetId: string, meta: PostMeta): Promise<void> =>
    ipcRenderer.invoke('save-post-meta', tweetId, meta),
});
