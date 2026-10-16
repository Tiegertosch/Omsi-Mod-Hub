/** Seitenzahlen rund um die aktuelle Seite, mit Lücken (null) dazwischen. */
export function pageWindow(page: number, pageCount: number, radius = 1): (number | null)[] {
  const pages = new Set([1, pageCount]);
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= pageCount) pages.add(p);
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push(null);
    result.push(p);
  });
  return result;
}
