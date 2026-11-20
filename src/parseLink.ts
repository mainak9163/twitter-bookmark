export interface ParsedLink {
  tweetId: string;
  username: string | null;
}

export function parseTweetLink(input: string): ParsedLink | null {
  let text = input.trim();
  if (!/^https?:\/\//i.test(text)) {
    text = 'https://' + text;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
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