# Filter Kit

Shared, brand-consistent filter components. One idiom for search / status / date / category filtering across admin, portal, instructor, and partner surfaces. Replaces the old per-page hand-rolled filters.

## Parts

| Component | Use |
|---|---|
| `FilterBar` | Layout shell. Flex-wrap row, optional `sticky`. Pass `reset` to render the Reset link at row end. |
| `FilterSearch` | Debounced text input (250ms) with leading icon + clear. |
| `FilterSelect` | Brand-skinned shadcn `Select` wrapper — the ONE idiom for status / category / type filtering. Use instead of native `<select>`, chip rows, or tab bars. Fold counts into the option label (`Active (42)`). |
| `FilterDateRange` | Popover + range Calendar (sage/terracotta). `admin/DateRangeFilter` is a back-compat re-export of this. |
| `FilterReset` | Terracotta reset link (rendered by `FilterBar` via its `reset` prop). |
| `useFilterState` | State engine + opt-in URL sync. |

> **No chips, pills, or tab rows for filtering.** Every discrete-choice filter is a `FilterSelect` dropdown — keeps multi-filter rows compact and uniform. The status `Pill` (see `design.md`) is for display only, never an interactive filter.

## Pattern

```tsx
import { FilterBar, FilterSearch, FilterSelect, useFilterState } from "@/components/filters";

const f = useFilterState(
  { search: "", status: "all" },
  { urlSync: true },               // admin tables: shareable ?search=&status=
);

<FilterBar reset={f.isActive ? f.reset : undefined} className="mb-4">
  <FilterSearch value={f.values.search} onChange={(v) => f.set("search", v)} placeholder="Search…" />
  <FilterSelect
    ariaLabel="Status"
    placeholder="Status"
    value={f.values.status}
    onChange={(v) => f.set("status", v)}
    options={[
      { value: "all", label: "All" },
      { value: "active", label: "Active (42)" },
    ]}
  />
</FilterBar>

// row predicate reads f.values.*
const rows = all.filter((r) =>
  (f.values.search === "" || r.name.toLowerCase().includes(f.values.search.toLowerCase())) &&
  (f.values.status === "all" || r.status === f.values.status),
);
```

**Match option `value` strings to whatever your predicate compares against.** An option `value: "studio"` against a predicate checking `"studio_pass"` silently breaks filtering unless the predicate maps it.

## useFilterState

```ts
const f = useFilterState(defaults, options?);
// f.values, f.set(key, value), f.setMany(partial), f.reset(), f.activeCount, f.isActive
```

- Default: plain `useState`, no router.
- `{ urlSync: true }`: mirrors values to `router.query` (shallow, debounced 300ms). String dimensions auto-sync. Default/`"all"`/empty values are stripped from the URL. Unrelated query keys (e.g. `?tab=`) are preserved.
- Non-string dimensions (e.g. a date range) need an explicit codec to URL-sync:
  ```ts
  import { dateRangeCodec } from "@/components/filters";
  useFilterState(
    { search: "", range: undefined },
    { urlSync: true, codecs: { range: dateRangeCodec("from", "to") } },
  );
  ```

### One URL owner per page

Only ONE `useFilterState({ urlSync: true })` per page may own the URL. A second filter block on the same page (e.g. CRM templates vs. message log) must use `urlSync: false` (local) to avoid query-key collisions.

## Conventions

- **Admin tables** → `urlSync: true` (shareable, survives refresh, back-button works).
- **Member / instructor / partner / public** → `urlSync: false` (local state).
- **Pickers are not filters.** Week/day navigation, view-mode toggles, and `Command` comboboxes keep their own idiom — do not route them through this kit.

## Tests

Pure codec logic: `npx tsx scripts/test-filter-codec.ts`. Components are verified via `tsc --noEmit` + lint + page smoke (repo has no component test runner).
