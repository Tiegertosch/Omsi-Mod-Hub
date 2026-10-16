export const SLUG_MIN = 3;
export const SLUG_MAX = 80;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TRANSLITERATION: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", æ: "ae", ø: "oe", å: "aa" };

/** Erzeugt einen URL-Slug, z. B. "Überland Straße 2" → "ueberland-strasse-2". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[äöüßæøå]/g, (char) => TRANSLITERATION[char] ?? char)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug);
}
