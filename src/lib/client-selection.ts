/** Resolve by name rather than array position so deleting/reordering clients is safe. */
export function resolveClientIndex(
  selected: string | null,
  names: readonly string[],
  preferred?: string,
) {
  const saved = selected === null ? -1 : names.indexOf(selected);
  if (saved >= 0) return saved;
  const fallback = preferred === undefined ? -1 : names.indexOf(preferred);
  return fallback >= 0 ? fallback : 0;
}
