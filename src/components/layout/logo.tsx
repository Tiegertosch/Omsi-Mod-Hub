import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#f6a723" />
      <rect x="7" y="6" width="18" height="20" rx="4" fill="#1b1203" />
      <rect x="9.5" y="8.5" width="13" height="3" rx="1" fill="#f6a723" />
      <rect x="9.5" y="13.5" width="13" height="6" rx="1.5" fill="#3a2a0c" />
      <circle cx="11.5" cy="23" r="1.4" fill="#ffe2a8" />
      <circle cx="20.5" cy="23" r="1.4" fill="#ffe2a8" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md">
      <LogoMark className="size-8" />
      <span className="font-display text-lg font-semibold tracking-tight text-fg">
        OMSI <span className="text-accent">Mod Hub</span>
      </span>
      <span className="sr-only">{siteConfig.name}</span>
    </Link>
  );
}
