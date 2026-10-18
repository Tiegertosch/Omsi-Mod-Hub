"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export type CarouselSlide = { key: string; src: string; alt: string };

/**
 * Texte kommen fertig übersetzt vom Server (der Namespace „Project“ wird nicht
 * an den Browser geschickt); `slide[i]` = „Bild i von n“, `show[i]` = „… anzeigen“.
 */
export type CarouselLabels = {
  carousel: string;
  media: string;
  slide: string;
  previous: string;
  next: string;
  thumbnails: string;
  slideOf: string[];
  show: string[];
};

// Uploads sind bereits serverseitig verkleinert und als WebP gespeichert.
const isUpload = (src: string) => src.startsWith("/media/");

/**
 * Titelbild und Screenshots in einem Karussell. Die Bildfläche ist ein
 * horizontaler Scroll-Container mit Scroll-Snapping: Wischen funktioniert
 * nativ und auch ohne JavaScript. Pfeile, Zähler, Vorschaubilder und
 * Pfeiltasten springen per scrollTo; der aktuelle Index folgt dem Scrollen.
 */
export function MediaCarousel({ slides, sizes, labels }: { slides: CarouselSlide[]; sizes: string; labels: CarouselLabels }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  const goTo = (index: number) => {
    const element = viewport.current;
    if (!element) return;
    const target = (index + total) % total;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: target * element.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    setCurrent(target);
  };

  const onScroll = () => {
    const element = viewport.current;
    if (!element || element.clientWidth === 0) return;
    const index = Math.round(element.scrollLeft / element.clientWidth);
    if (index !== current) setCurrent(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(current + 1);
    }
  };

  return (
    <section aria-roledescription={labels.carousel} aria-label={labels.media} className="space-y-3">
      <div className="relative">
        <div
          ref={viewport}
          onScroll={onScroll}
          onKeyDown={total > 1 ? onKeyDown : undefined}
          tabIndex={total > 1 ? 0 : undefined}
          className={cn(
            "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[var(--radius-card)] border border-border bg-surface-3",
            "[scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-scrollbar]:hidden",
          )}
        >
          {slides.map((slide, index) => (
            <div
              key={slide.key}
              role="group"
              aria-roledescription={labels.slide}
              aria-label={labels.slideOf[index]}
              className="relative aspect-video w-full shrink-0 snap-start"
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                sizes={sizes}
                // Erstes Bild ist das größte Element der Seite (LCP); die übrigen laden verzögert.
                priority={index === 0}
                unoptimized={isUpload(slide.src)}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              aria-label={labels.previous}
              className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-fg backdrop-blur transition-colors hover:bg-bg/90"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              aria-label={labels.next}
              className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 text-fg backdrop-blur transition-colors hover:bg-bg/90"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
            <p
              aria-live="polite"
              className="absolute right-3 bottom-3 rounded-md bg-bg/70 px-2 py-0.5 text-xs font-medium text-fg tabular-nums backdrop-blur"
            >
              <span className="sr-only">{labels.slideOf[current]}</span>
              <span aria-hidden>
                {current + 1} / {total}
              </span>
            </p>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={labels.thumbnails}>
          {slides.map((slide, index) => (
            <li key={slide.key} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(index)}
                aria-label={labels.show[index]}
                aria-current={index === current ? "true" : undefined}
                className={cn(
                  "relative block h-14 w-24 overflow-hidden rounded-md border-2 bg-surface-3 transition-[border-color,opacity] sm:h-16 sm:w-28",
                  index === current ? "border-accent" : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                <Image src={slide.src} alt="" fill sizes="112px" unoptimized={isUpload(slide.src)} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
