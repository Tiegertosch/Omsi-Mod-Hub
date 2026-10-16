import { AudioLines, Boxes, Bus, Map, Paintbrush, Shapes, Wrench, type LucideIcon } from "lucide-react";

import type { CategoryIconName } from "@/lib/admin-forms";

const icons: Record<CategoryIconName, LucideIcon> = {
  bus: Bus,
  map: Map,
  paintbrush: Paintbrush,
  boxes: Boxes,
  "audio-lines": AudioLines,
  wrench: Wrench,
};

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && Object.hasOwn(icons, name) ? icons[name as CategoryIconName] : null) ?? Shapes;
}
