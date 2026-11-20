"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchError = void 0;
exports.toTweet = toTweet;
exports.fetchTweet = fetchTweet;
const API_BASE = 'https://api.fxtwitter.com/2/status/';
const TIMEOUT_MS = 15000;
class FetchError extends Error {
}
exports.FetchError = FetchError;
function statusToTweet(status) {
    const media = (status.media?.all ?? []).map((m) => ({
        type: m.type,
        url: m.url,
        thumbnailUrl: m.thumbnail_url ?? null,
        width: m.width ?? null,
        height: m.height ?? null,
        durationSeconds: m.duration ?? null,
        localFile: null
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
function toTweet(raw) {
    if (!raw.status) {
        throw new FetchError('Response had no tweet data.');
    }
    const tweet = statusToTweet(raw.status);
    tweet.raw = raw;
    return tweet;
}
async function fetchTweet(tweetId) {
    let response;
    try {
        response = await fetch(API_BASE + tweetId, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    }
    catch {
        throw new FetchError('Could not reach the tweet service (network error or timeout).');
    }
    let raw;
    try {
        raw = (await response.json());
    }
    catch {
        throw new FetchError('The tweet service did not return valid JSON.');
    }
    if (!raw.status) {
        const code = raw.code ?? response.status;
        throw new FetchError(`Tweet not available (code ${code}). It may be deleted or private.`);
    }
    return toTweet(raw);
}
