/** First token of display name — used to match "Usha" with "Usha Rao", etc. */
export function normalizeInstructorKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().split(/\s+/)[0] ?? trimmed.toLowerCase();
}

type InstructorLike = {
  id: string;
  name: string;
  display_order?: number | null;
  about?: string | null;
  image_url?: string | null;
  specialties?: string[];
};

function instructorRichness(row: InstructorLike): number {
  return (
    (row.about?.length ?? 0) +
    (row.image_url ? 50 : 0) +
    (row.specialties?.length ?? 0) * 10
  );
}

/** Keep one row per person (by first name); prefers lower display_order, then richer profile. */
export function dedupeInstructorRows<T extends InstructorLike>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const key = normalizeInstructorKey(row.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const kept: T[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const orderA = a.display_order ?? 9999;
      const orderB = b.display_order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return instructorRichness(b) - instructorRichness(a);
    });
    kept.push(sorted[0]);
  }

  return kept.sort(
    (a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999),
  );
}
