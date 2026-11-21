"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    platform: process.platform, // for title-bar spacing (macOS traffic lights sit on the left)
    setTitleBarTint: (tint) => electron_1.ipcRenderer.send('set-title-bar-tint', tint),
    saveLink: (url) => electron_1.ipcRenderer.invoke('save-link', url),
    listPosts: () => electron_1.ipcRenderer.invoke('list-posts'),
    listFolders: () => electron_1.ipcRenderer.invoke('list-folders'),
    listFolderSummaries: () => electron_1.ipcRenderer.invoke('list-folder-summaries'),
    listPostsInFolder: (folderId) => electron_1.ipcRenderer.invoke('list-posts-in-folder', folderId),
    getPost: (tweetId) => electron_1.ipcRenderer.invoke('get-post', tweetId),
    addFolder: (name, description, color) => electron_1.ipcRenderer.invoke('add-folder', name, description, color),
    updateFolder: (id, changes) => electron_1.ipcRenderer.invoke('update-folder', id, changes),
    deleteFolder: (id) => electron_1.ipcRenderer.invoke('delete-folder', id),
    trashPost: (tweetId) => electron_1.ipcRenderer.invoke('trash-post', tweetId),
    restorePost: (tweetId) => electron_1.ipcRenderer.invoke('restore-post', tweetId),
    purgeTrash: (tweetId) => electron_1.ipcRenderer.invoke('purge-trash', tweetId),
    copyText: (text) => electron_1.ipcRenderer.send('copy-text', text),
    savePostMeta: (tweetId, meta) => electron_1.ipcRenderer.invoke('save-post-meta', tweetId, meta),
});
