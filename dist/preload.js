"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    saveLink: (url) => electron_1.ipcRenderer.invoke('save-link', url),
    listPosts: () => electron_1.ipcRenderer.invoke('list-posts'),
    listFolders: () => electron_1.ipcRenderer.invoke('list-folders'),
    listFolderSummaries: () => electron_1.ipcRenderer.invoke('list-folder-summaries'),
    listPostsInFolder: (folderId) => electron_1.ipcRenderer.invoke('list-posts-in-folder', folderId),
    getPost: (tweetId) => electron_1.ipcRenderer.invoke('get-post', tweetId),
    addFolder: (name, description, color) => electron_1.ipcRenderer.invoke('add-folder', name, description, color),
    savePostMeta: (tweetId, meta) => electron_1.ipcRenderer.invoke('save-post-meta', tweetId, meta),
});
