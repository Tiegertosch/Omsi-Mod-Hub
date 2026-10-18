import { z } from "zod";

import { MAX_QUERY_LENGTH } from "./search-text";

export const CATALOG_SORTS = ["newest", "updated", "popular"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** Preisfilter: alle, nur Freeware oder nur Payware (URL `?price=free|paid`). */
export const CATALOG_PRICES = ["all", "free", "paid"] as const;
export type CatalogPrice = (typeof CATALOG_PRICES)[number];

export const CATALOG_PAGE_SIZE = 12;
export const MAX_CATALOG_PAGE = 500;
export const MAX_TAG_FILTERS = 5;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CatalogParams = {
  q: string;
  tags: string[];
  sort: CatalogSort;
  price: CatalogPrice;
  page: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const all = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const querySchema = z
  .string()
  .transform((value) => value.trim().slice(0, MAX_QUERY_LENGTH))
  .catch("");
const sortSchema = z.enum(CATALOG_SORTS).catch("newest");
const priceSchema = z.enum(CATALOG_PRICES).catch("all");
const pageSchema = z.coerce.number().int().min(1).max(MAX_CATALOG_PAGE).catch(1);

/**
 * Liest Katalogparameter aus der URL. Ungültige Werte fallen auf sichere
 * Standardwerte zurück, statt einen Fehler auszulösen (geteilte Links bleiben nutzbar).
 */
export function parseCatalogParams(searchParams: RawSearchParams): CatalogParams {
  const tags = all(searchParams.tag)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length <= 64 && SLUG_PATTERN.test(value));

  return {
    q: querySchema.parse(first(searchParams.q) ?? ""),
    tags: Array.from(new Set(tags)).slice(0, MAX_TAG_FILTERS),
    sort: sortSchema.parse(first(searchParams.sort)),
    price: priceSchema.parse(first(searchParams.price)),
    page: pageSchema.parse(first(searchParams.page) ?? 1),
  };
}

/** Erzeugt den Query-String für Katalog-Links; Standardwerte werden weggelassen. */
export function catalogQuery(params: Partial<CatalogParams>): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  if (params.q) query.q = params.q;
  if (params.tags && params.tags.length > 0) query.tag = params.tags;
  if (params.sort && params.sort !== "newest") query.sort = params.sort;
  if (params.price && params.price !== "all") query.price = params.price;
  if (params.page && params.page > 1) query.page = String(params.page);
  return query;
}

export function toggleTag(tags: readonly string[], slug: string): string[] {
  return tags.includes(slug) ? tags.filter((tag) => tag !== slug) : [...tags, slug].slice(0, MAX_TAG_FILTERS);
}
