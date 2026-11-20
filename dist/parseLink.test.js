"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const parseLink_1 = require("./parseLink");
const ok = (0, parseLink_1.parseTweetLink)('https://x.com/jack/status/20');
strict_1.default.equal(ok?.tweetId, '20');
strict_1.default.equal(ok?.username, 'jack');
strict_1.default.equal((0, parseLink_1.parseTweetLink)('https://twitter.com/jack/status/20?s=20')?.tweetId, '20');
strict_1.default.equal((0, parseLink_1.parseTweetLink)('x.com/jack/status/20')?.tweetId, '20');
strict_1.default.equal((0, parseLink_1.parseTweetLink)('https://mobile.twitter.com/jack/status/20/photo/1')?.tweetId, '20');
strict_1.default.equal((0, parseLink_1.parseTweetLink)('https://x.com/i/web/status/20')?.username, null);
strict_1.default.equal((0, parseLink_1.parseTweetLink)('https://x.com/jack'), null);
strict_1.default.equal((0, parseLink_1.parseTweetLink)('https://example.com/jack/status/20'), null);
strict_1.default.equal((0, parseLink_1.parseTweetLink)('hello'), null);
console.log('parseLink: all checks passed');
