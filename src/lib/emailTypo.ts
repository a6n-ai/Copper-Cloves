// Heuristic typo correction for email addresses entered when inviting guests.
// Catches the common cases that silently create duplicate accounts:
//   gmail.comm / gmail.con / gmial.com / gmal.com / yahooo.com / hotmial.com …
// Returns a suggested correction, or null when the address looks fine.

const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
];

// High-confidence TLD typos → the intended ending.
const TLD_FIXES: Record<string, string> = {
  ".comm": ".com",
  ".con": ".com",
  ".cim": ".com",
  ".cm": ".com",
  ".ocm": ".com",
  ".vom": ".com",
  ".xom": ".com",
  ".cpm": ".com",
  ".col": ".com",
  ".co": ".com", // for gmail/yahoo etc. — handled only when domain matches a provider stem
  ".om": ".com",
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

/** Returns a corrected email if a likely typo is detected, else null. */
export function suggestEmailCorrection(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return null;

  let fixed = domain;

  // 1) TLD typo fixes (suffix match).
  for (const [bad, good] of Object.entries(TLD_FIXES)) {
    if (fixed.endsWith(bad)) {
      const stem = fixed.slice(0, -bad.length);
      // Only collapse ".co"→".com" / ".om"→".com" for known provider stems to
      // avoid breaking real ccTLDs (e.g. example.co.in stays).
      if ((bad === ".co" || bad === ".om" || bad === ".cm") && !COMMON_DOMAINS.includes(`${stem}.com`)) {
        continue;
      }
      fixed = stem + good;
      break;
    }
  }

  // 2) Whole-domain near-match to a known provider (edit distance 1–2).
  if (!COMMON_DOMAINS.includes(fixed)) {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const d of COMMON_DOMAINS) {
      const dist = levenshtein(fixed, d);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    // Distance 1 always; distance 2 only for longer domains to limit false positives.
    if (best && (bestDist === 1 || (bestDist === 2 && fixed.length >= 9))) {
      fixed = best;
    }
  }

  const suggestion = `${local}@${fixed}`;
  return suggestion !== email ? suggestion : null;
}
