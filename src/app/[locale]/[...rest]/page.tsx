import { notFound } from "next/navigation";

/** Unbekannte Pfade unterhalb einer Sprache zeigen die lokalisierte 404-Seite. */
export default function CatchAllPage() {
  notFound();
}
