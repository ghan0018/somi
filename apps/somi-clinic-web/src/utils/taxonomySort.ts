import type { TaxonomyTag } from '../types';

/**
 * Group taxonomy tags by category and sort age tags numerically.
 *
 * Age labels follow patterns like "0-5", "6-12", "13-18", "19+" where the
 * leading number determines the display order. Without explicit sorting these
 * labels sort alphabetically ("0-5", "13-18", "6-12") which is confusing.
 *
 * Non-numeric labels (e.g. "Adult") sort to the end.
 */
export function sortTagsByCategory(
  tags: TaxonomyTag[],
): Record<string, TaxonomyTag[]> {
  const grouped = tags.reduce<Record<string, TaxonomyTag[]>>((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {});

  // Sort age tags numerically by the leading number in the label
  if (grouped.age) {
    grouped.age.sort((a, b) => {
      const matchA = a.label.match(/\d+/);
      const matchB = b.label.match(/\d+/);
      const numA = matchA ? parseInt(matchA[0], 10) : Infinity;
      const numB = matchB ? parseInt(matchB[0], 10) : Infinity;
      return numA - numB;
    });
  }

  return grouped;
}
