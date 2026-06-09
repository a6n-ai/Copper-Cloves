// src/lib/search/index.ts
import { SEARCH_MIN_CHARS, type SearchGroup, type SearchRole, type SearchScope } from "./types";
import { adminSearch } from "./adminSearch";
import { memberSearch, instructorSearch, partnerSearch } from "./portalSearch";

export * from "./types";

export async function runSearch(
  role: SearchRole,
  q: string,
  scope: SearchScope
): Promise<SearchGroup[]> {
  const query = q.trim();
  if (query.length < SEARCH_MIN_CHARS) return [];
  switch (role) {
    case "admin": return adminSearch(query);
    case "member": return memberSearch(query, scope);
    case "instructor": return instructorSearch(query, scope);
    case "partner": return partnerSearch(query, scope);
    default: return [];
  }
}
