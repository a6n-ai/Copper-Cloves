// src/lib/search/types.ts
export type SearchRole = "admin" | "member" | "instructor" | "partner";

/** A single result row. icon + pill are resolved client-side from `type`. */
export interface SearchItem {
  id: string;
  type: string;          // "member" | "schedule" | "payment" | "product" | "cafe" | "partner" | "instructor" | "booking" | "package"
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchGroup {
  type: string;          // group key, matches item.type for the group
  label: string;         // display heading, e.g. "Members"
  items: SearchItem[];
}

/** Scope ids carried on the session, used to filter partner/instructor branches. */
export interface SearchScope {
  userId: string;
  partnerId?: string | null;
  instructorId?: string | null;
}

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_TAKE = 5;
