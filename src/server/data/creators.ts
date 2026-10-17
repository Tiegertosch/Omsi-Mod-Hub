import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { tokenizeQuery } from "@/lib/search-text";
import { CACHE_TAGS } from "@/server/public-cache";

/** Öffentlich sichtbar sind nur nicht gesperrte Konten mit Creator-Profil und mindestens einem veröffentlichten Projekt. */
export const publicCreatorWhere = {
  banned: false,
  creatorProfile: { isNot: null },
  projects: { some: { status: "PUBLISHED" } },
} satisfies Prisma.UserWhereInput;

const creatorSelect = {
  id: true,
  username: true,
  isSample: true,
  createdAt: true,
  creatorProfile: {
    select: { displayName: true, bio: true, websiteUrl: true, avatarUrl: true, verification: true },
  },
  _count: { select: { projects: { where: { status: "PUBLISHED" } } } },
} satisfies Prisma.UserSelect;

export type CreatorSummary = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  websiteUrl: string | null;
  avatarUrl: string | null;
  verified: boolean;
  projectCount: number;
  isSample: boolean;
  createdAt: Date;
};

function toSummary(row: Prisma.UserGetPayload<{ select: typeof creatorSelect }>): CreatorSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.creatorProfile?.displayName ?? row.username,
    bio: row.creatorProfile?.bio ?? null,
    websiteUrl: row.creatorProfile?.websiteUrl ?? null,
    avatarUrl: row.creatorProfile?.avatarUrl ?? null,
    verified: row.creatorProfile?.verification === "VERIFIED",
    projectCount: row._count.projects,
    isSample: row.isSample,
    createdAt: row.createdAt,
  };
}

export async function getCreators(options: { take?: number; q?: string } = {}): Promise<CreatorSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.lists);
  const terms = tokenizeQuery(options.q ?? "");
  const rows = await db.user.findMany({
    where: {
      ...publicCreatorWhere,
      AND: terms.map((term) => ({
        OR: [{ username: { contains: term } }, { creatorProfile: { displayName: { contains: term } } }],
      })),
    },
    select: creatorSelect,
    orderBy: [{ projects: { _count: "desc" } }, { username: "asc" }],
    take: options.take ?? 60,
  });
  return rows.map(toSummary);
}

export async function getCreatorByUsername(username: string): Promise<CreatorSummary | null> {
  "use cache";
  cacheLife("minutes");
  // Profil sofort aktuell (creator-Tag), Projektanzahl über die Listen.
  cacheTag(CACHE_TAGS.creator(username.toLowerCase()), CACHE_TAGS.lists);
  const row = await db.user.findFirst({
    where: { ...publicCreatorWhere, username: username.toLowerCase() },
    select: creatorSelect,
  });
  return row ? toSummary(row) : null;
}

export async function getCreatorSitemapEntries() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.lists);
  return db.user.findMany({
    where: publicCreatorWhere,
    select: { username: true, updatedAt: true },
    take: 45000,
  });
}
