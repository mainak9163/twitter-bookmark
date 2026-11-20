interface SaveResult {
  ok: boolean;
  message: string;
}

interface Folder {
  id: string;
  name: string;
  description: string;
}

interface PostMeta {
  folderId: string | null;
  note: string;
}

interface PostSummary {
  id: string;
  authorHandle: string;
  text: string;
  savedAt: string;
  screenshotUrl: string | null;
  folderId: string | null;
  note: string;
}

interface Window {
  api: {
    saveLink(url: string): Promise<SaveResult>;
    listPosts(): Promise<PostSummary[]>;
    listFolders(): Promise<Folder[]>;
    addFolder(name: string, description: string): Promise<Folder[]>;
    savePostMeta(tweetId: string, meta: PostMeta): Promise<void>;
  };
}