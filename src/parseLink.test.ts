import assert from 'node:assert/strict';
import { parseTweetLink } from './parseLink';

const ok = parseTweetLink('https://x.com/jack/status/20');
assert.equal(ok?.tweetId, '20');
assert.equal(ok?.username, 'jack');

assert.equal(parseTweetLink('https://twitter.com/jack/status/20?s=20')?.tweetId, '20');
assert.equal(parseTweetLink('x.com/jack/status/20')?.tweetId, '20');
assert.equal(parseTweetLink('https://mobile.twitter.com/jack/status/20/photo/1')?.tweetId, '20');
assert.equal(parseTweetLink('https://x.com/i/web/status/20')?.username, null);

assert.equal(parseTweetLink('https://x.com/jack'), null);
assert.equal(parseTweetLink('https://example.com/jack/status/20'), null);
assert.equal(parseTweetLink('hello'), null);

console.log('parseLink: all checks passed');