/**
 * Best-effort "OS · Browser" label from a User-Agent string. Browsers do not
 * expose a real device name (e.g. "Sarah's iPhone"), so this is the ceiling of
 * what's knowable. Order matters: Edge/Chrome UA strings both contain "Chrome",
 * and Safari UA contains "Safari" but Chrome does too — check the more specific
 * token first.
 */
export function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown";

  let os = "";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "Mac";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";

  if (os && browser) return `${os} · ${browser}`;
  if (os) return os;
  if (browser) return browser;
  return "Unknown";
}