/**
 * Splits a string for search highlighting. Case-insensitive; all matches of `q` are included.
 * Returns non-empty segments; only matched runs have `match: true`.
 */
export function getHighlightSegments(name: string, q: string): { text: string; match: boolean }[] {
  const needle = q.trim();
  if (needle.length === 0) {
    return name.length > 0 ? [{ text: name, match: false }] : [];
  }
  const lowerN = name.toLowerCase();
  const lowerQ = needle.toLowerCase();
  const qlen = lowerQ.length;
  const out: { text: string; match: boolean }[] = [];
  let i = 0;
  while (i < name.length) {
    const from = lowerN.indexOf(lowerQ, i);
    if (from === -1) {
      out.push({ text: name.slice(i), match: false });
      break;
    }
    if (from > i) {
      out.push({ text: name.slice(i, from), match: false });
    }
    out.push({ text: name.slice(from, from + qlen), match: true });
    i = from + qlen;
  }
  return out;
}
