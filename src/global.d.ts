interface SaveResult {
  ok: boolean;
  message: string;
}

interface Folder {
  id: string;
  name: string;
  description: string;
  color: string; // one of the 8 folder colours, e.g. "#5CC08B"
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
    saveLink(url: string): Promise<SaveResult>;
    listPosts(): Promise<PostSummary[]>;
    listFolders(): Promise<Folder[]>;
    listFolderSummaries(): Promise<FolderSummary[]>;
    listPostsInFolder(folderId: string): Promise<PostSummary[]>;
    getPost(tweetId: string): Promise<PostDetail | null>;
    addFolder(name: string, description: string, color?: string): Promise<Folder[]>;
    savePostMeta(tweetId: string, meta: PostMeta): Promise<void>;
  };
}
