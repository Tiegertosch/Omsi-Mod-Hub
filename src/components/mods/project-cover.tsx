import Image from "next/image";

import { LogoMark } from "@/components/layout/logo";
import { isSafeImageSrc } from "@/lib/external-url";
import { cn } from "@/lib/utils";

export function ProjectCover({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-video overflow-hidden bg-surface-3", className)}>
      {isSafeImageSrc(src) ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          // Uploads sind bereits serverseitig verkleinert und als WebP gespeichert.
          unoptimized={src.startsWith("/media/")}
          className="object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgb(246_167_35/0.12),transparent_60%)]">
          <LogoMark className="size-12 opacity-40 grayscale" />
        </div>
      )}
    </div>
  );
}
