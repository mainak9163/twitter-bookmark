import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { toTweet } from './fetcher';

const file = path.join(__dirname, '..', 'fixtures', 'video-tweet.json');
const tweet = toTweet(JSON.parse(fs.readFileSync(file, 'utf8')));

assert.equal(tweet.id, '2118308539424985232');
assert.equal(tweet.authorHandle, 'GetTheFabulous');
assert.equal(tweet.createdAt, '2026-11-05T11:44:46.000Z');
assert.equal(tweet.media.length, 1);
assert.equal(tweet.media[0].type, 'video');
assert.ok(tweet.media[0].url.includes('.mp4'));

console.log('fetcher: all checks passed');