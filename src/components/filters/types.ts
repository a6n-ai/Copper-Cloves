import type { ParsedUrlQuery } from "querystring";

export type ChipOption = { value: string; label: string; count?: number };
export type SelectOption = { value: string; label: string };

/**
 * A codec owns one logical filter dimension's mapping to/from the URL query.
 * A dimension may span several query keys (e.g. a date range owns from+to).
 */
export interface FilterCodec<T> {
  /** query keys this dimension reads/writes */
  keys: string[];
  /** true when value equals the default → strip from URL */
  isDefault: (value: T) => boolean;
  /** value → query fragment (undefined values are deleted) */
  toQuery: (value: T) => Record<string, string | undefined>;
  /** query → value (falls back to the dimension default when absent) */
  fromQuery: (query: ParsedUrlQuery) => T;
}
