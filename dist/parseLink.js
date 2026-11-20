"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTweetLink = parseTweetLink;
function parseTweetLink(input) {
    let text = input.trim();
    if (!/^https?:\/\//i.test(text)) {
        text = 'https://' + text;
    }
    let url;
    try {
        url = new URL(text);
    }
    catch {
        return null;
    }
    const host = url.hostname.toLowerCase().replace(/^(www|mobile)\./, '');
    if (host !== 'twitter.com' && host !== 'x.com') {
        return null;
    }
    const idMatch = url.pathname.match(/\/status(?:es)?\/(\d+)/);
    if (!idMatch) {
        return null;
    }
    const firstSegment = url.pathname.split('/')[1];
    const username = firstSegment && firstSegment !== 'i' ? firstSegment : null;
    return { tweetId: idMatch[1], username };
}
