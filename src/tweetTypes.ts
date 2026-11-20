export interface TweetMedia {
  type: string; // "video" so far; photos and gifs not seen yet
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  localFile:string | null;
}

export interface Tweet {
  id: string; 
  url: string;
  text: string;
  createdAt: string; // ISO date
  authorHandle: string;
  authorName: string;
  media: TweetMedia[];
  raw: unknown; 
  replyingToId: string | null; // parent tweet, if this is a reply
  quoted: Tweet | null;
  localFile: string | null;
}