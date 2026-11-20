"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    listPosts: () => electron_1.ipcRenderer.invoke('list-posts'),
    saveLink: (url) => electron_1.ipcRenderer.invoke('save-link', url),
    listFolders: () => electron_1.ipcRenderer.invoke('list-folders'),
    addFolder: (name, description) => electron_1.ipcRenderer.invoke('add-folder', name, description),
    savePostMeta: (tweetId, meta) => electron_1.ipcRenderer.invoke('save-post-meta', tweetId, meta),
});
