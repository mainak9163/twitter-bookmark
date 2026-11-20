"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fetcher_1 = require("./fetcher");
const file = node_path_1.default.join(__dirname, '..', 'fixtures', 'video-tweet.json');
const tweet = (0, fetcher_1.toTweet)(JSON.parse(node_fs_1.default.readFileSync(file, 'utf8')));
strict_1.default.equal(tweet.id, '2118308539424985232');
strict_1.default.equal(tweet.authorHandle, 'GetTheFabulous');
strict_1.default.equal(tweet.createdAt, '2026-11-05T11:44:46.000Z');
strict_1.default.equal(tweet.media.length, 1);
strict_1.default.equal(tweet.media[0].type, 'video');
strict_1.default.ok(tweet.media[0].url.includes('.mp4'));
console.log('fetcher: all checks passed');
