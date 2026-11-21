interface SaveResult {
  ok: boolean;
  message: string;
  tweetId?: string; // set when ok
  alreadySaved?: boolean;
}

interface Folder {
  id: string;
  name: string;
  description: string;
  color: string; // one of the 8 folder colours, e.g. "#5CC08B"
}

interface FolderChanges {
  name?: string;
  description?: string;
  color?: string;
}

// Folder card data for the Home screen.
interface FolderSummary extends Folder {
  count: number;
  lastSavedAt: string | null; // ISO date of newest post, null if empty
  thumbs: string[]; // up to 3 image URLs of the newest posts
}

interface PostMeta {
  folderId: string | null; // null = General
  note: string;
}

// Light post data for lists and grids.
interface PostSummary {
  id: string;
  authorHandle: string;
  authorName: string;
  text: string;
  createdAt: string;
  savedAt: string;
  screenshotUrl: string | null;
  thumbUrl: string | null; // screenshot, else first saved photo
  photoUrl: string | null; // first saved photo, if any
  mediaTypes: string[]; // e.g. ["photo", "video"]
  folderId: string; // always a real folder id ("general" if unsorted)
  note: string;
}

interface MediaItem {
  type: string; // "photo" | "video" | "gif"
  fileUrl: string | null; // local file URL, null if download failed
  remoteUrl: string;
  width: number | null;
  height: number | null;
}

interface QuotedPost {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  authorHandle: string;
  authorName: string;
  media: MediaItem[];
}

// Everything the post detail view needs.
interface PostDetail extends QuotedPost {
  replyingToId: string | null;
  quoted: QuotedPost | null;
  savedAt: string;
  screenshotUrl: string | null;
  folderId: string;
  note: string;
}

interface Window {
  api: {
    platform: string;
    setTitleBarTint(tint: 'none' | 'dim' | 'dark'): void;
    saveLink(url: string): Promise<SaveResult>;
    listPosts(): Promise<PostSummary[]>;
    listFolders(): Promise<Folder[]>;
    listFolderSummaries(): Promise<FolderSummary[]>;
    listPostsInFolder(folderId: string): Promise<PostSummary[]>;
    getPost(tweetId: string): Promise<PostDetail | null>;
    addFolder(name: string, description: string, color?: string): Promise<Folder[]>;
    updateFolder(id: string, changes: FolderChanges): Promise<Folder[]>;
    deleteFolder(id: string): Promise<Folder[]>;
    trashPost(tweetId: string): Promise<void>;
    restorePost(tweetId: string): Promise<void>;
    purgeTrash(tweetId: string): Promise<void>;
    copyText(text: string): void;
    onUpdateReady(callback: (version: string) => void): void;
    pendingUpdate(): Promise<string | null>;
    installUpdate(): void;
    savePostMeta(tweetId: string, meta: PostMeta): Promise<void>;
  };
}
