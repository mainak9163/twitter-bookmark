import { Tweet, TweetMedia } from './tweetTypes';

const API_BASE = 'https://api.fxtwitter.com/2/status/';
const TIMEOUT_MS = 15000;


interface RawMedia {
  type: string;
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number;
}

interface RawStatus {
  id: string;
  url: string;
  text: string;
  created_timestamp: number;
  author: { screen_name: string; name: string };
  media?: { all?: RawMedia[] };
  quote?: RawStatus | null;
  replying_to?: { status: string } | null;
}

interface RawResponse {
  code?: number;
  status?: RawStatus | null;
}

export class FetchError extends Error {}

function statusToTweet(status: RawStatus): Tweet {
  const media: TweetMedia[] = (status.media?.all ?? []).map((m) => ({
    type: m.type,
    url: m.url,
    thumbnailUrl: m.thumbnail_url ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
    durationSeconds: m.duration ?? null,
    localFile:null
  }));

  return {
    id: status.id,
    url: status.url,
    text: status.text,
    createdAt: new Date(status.created_timestamp * 1000).toISOString(),
    authorHandle: status.author.screen_name,
    authorName: status.author.name,
    media,
    replyingToId: status.replying_to?.status ?? null,
    quoted: status.quote ? statusToTweet(status.quote) : null,
    raw: status,
     localFile: null,
  };
}

export function toTweet(raw: RawResponse): Tweet {
  if (!raw.status) {
    throw new FetchError('Response had no tweet data.');
  }
  const tweet = statusToTweet(raw.status);
  tweet.raw = raw;
  return tweet;
}

export async function fetchTweet(tweetId: string): Promise<Tweet> {
  let response: Response;
  try {
    response = await fetch(API_BASE + tweetId, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new FetchError('Could not reach the tweet service (network error or timeout).');
  }

  let raw: RawResponse;
  try {
    raw = (await response.json()) as RawResponse;
  } catch {
    throw new FetchError('The tweet service did not return valid JSON.');
  }

  if (!raw.status) {
    const code = raw.code ?? response.status;
    throw new FetchError(`Tweet not available (code ${code}). It may be deleted or private.`);
  }

  return toTweet(raw);
}