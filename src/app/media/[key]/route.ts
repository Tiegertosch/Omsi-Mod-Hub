import { NextResponse } from "next/server";

import { MEDIA_KEY_PATTERN } from "@/lib/image-signature";
import { readMedia } from "@/server/storage";

/** Liefert hochgeladene, serverseitig neu kodierte Bilder aus. */
export async function GET(_request: Request, context: RouteContext<"/media/[key]">) {
  const { key } = await context.params;
  if (!MEDIA_KEY_PATTERN.test(key)) return new NextResponse(null, { status: 404 });

  const data = await readMedia(key);
  if (!data) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(data.length),
      // Schlüssel sind zufällig und unveränderlich – dauerhaft cachebar.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
