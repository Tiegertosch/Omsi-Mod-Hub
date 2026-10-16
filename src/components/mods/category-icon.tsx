import { AudioLines, Boxes, Bus, Map, Paintbrush, Shapes, Wrench, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  bus: Bus,
  map: Map,
  paintbrush: Paintbrush,
  boxes: Boxes,
  "audio-lines": AudioLines,
  wrench: Wrench,
};

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && icons[name]) || Shapes;
}
