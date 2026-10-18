import { Fragment } from "react";

import { parseRichText, type RichInline } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

function Inline({ nodes }: { nodes: RichInline[] }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.text}</Fragment>;
      case "break":
        return <br key={index} />;
      case "strong":
        return (
          <strong key={index} className="font-semibold text-fg">
            <Inline nodes={node.children} />
          </strong>
        );
      case "em":
        return (
          <em key={index}>
            <Inline nodes={node.children} />
          </em>
        );
      case "underline":
        return (
          <u key={index} className="underline-offset-2">
            <Inline nodes={node.children} />
          </u>
        );
    }
  });
}

/**
 * Formatierter Nutzertext (Beschreibung, Installationsanleitung), siehe
 * `src/lib/rich-text.ts`. Überschriften beginnen bei h3, weil die Abschnitte
 * der Projektseite selbst h2 sind.
 */
export function RichText({ text, lang, className }: { text: string; lang?: string; className?: string }) {
  return (
    <div lang={lang} className={cn("space-y-3 text-[0.95rem] leading-relaxed break-words text-fg/90", className)}>
      {parseRichText(text).map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h3 key={index} className="pt-2 text-lg font-semibold text-fg">
                <Inline nodes={block.content} />
              </h3>
            ) : (
              <h4 key={index} className="pt-1 text-base font-semibold text-fg">
                <Inline nodes={block.content} />
              </h4>
            );
          case "paragraph":
            return (
              <p key={index}>
                <Inline nodes={block.content} />
              </p>
            );
          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                <Inline nodes={item} />
              </li>
            ));
            return block.ordered ? (
              <ol key={index} start={block.start === 1 ? undefined : block.start} className="list-decimal space-y-1 pl-6">
                {items}
              </ol>
            ) : (
              <ul key={index} className="list-disc space-y-1 pl-6">
                {items}
              </ul>
            );
          }
        }
      })}
    </div>
  );
}
