import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  title,
  description,
  action,
  as: Tag = "h2",
  className,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div>
        <Tag id={id} className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
          {title}
        </Tag>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
