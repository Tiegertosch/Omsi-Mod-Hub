/**
 * HTML-Fassung der E-Mails im Stil der Website: dunkle Kopfzeile mit dem
 * Schriftzug, heller Inhalt, Amber-Button. Erzeugt wird sie aus dem Klartext
 * (Absätze durch Leerzeilen), der unverändert als Alternative mitgeht.
 *
 * Mail-taugliches HTML: Tabellen-Layout, nur Inline-Styles, keine Bilder
 * (werden oft blockiert), kein Skript. Jeder Text – auch Namen, Projekttitel
 * und Begründungen von Nutzern bzw. der Moderation – wird escaped.
 */

export type EmailLink = { url: string; label: string };

export type EmailLayout = {
  locale: string;
  subject: string;
  /** Klartext der Mail; Absätze durch Leerzeilen getrennt */
  text: string;
  /** Hauptlink: Der Absatz, der genau diese URL enthält, wird zum Button. */
  cta?: EmailLink;
  /** Zweiter Link als schlichter Button (z. B. Widerspruch, Passwort-Reset). */
  secondary?: EmailLink;
  /** Absätze, die als Kasten erscheinen (Begründungen der Moderation). */
  highlight?: (string | null | undefined)[];
  /** Absatz, der als großer Code erscheint (Bestätigungscode). */
  code?: string;
  /** Absätze, die nie verlinkt werden (z. B. ein gesperrter Downloadlink). */
  plain?: string[];
  labels: { fallback: string; footer: string; imprint: string; privacy: string };
  links: { imprint: string; privacy: string };
};

const COLORS = {
  page: "#eef0f3",
  header: "#0a0d12",
  headerText: "#e9edf3",
  accent: "#f6a723",
  accentText: "#1b1203",
  text: "#1f2530",
  muted: "#5b6472",
  link: "#9a5b00",
  quote: "#fbf6ea",
  border: "#e3e6eb",
  footer: "#f6f7f9",
} as const;
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const URL_ONLY = /^https?:\/\/\S+$/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, Zeilenumbrüche als <br>, Adressen im Fließtext verlinkt. */
function inline(value: string): string {
  return escapeHtml(value)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:${COLORS.link};">${url}</a>`)
    .replace(/\n/g, "<br>");
}

function paragraph(html: string, style = ""): string {
  return `<p style="margin:0 0 16px;font:15px/1.6 ${FONT};color:${COLORS.text};${style}">${html}</p>`;
}

function button(link: EmailLink, primary: boolean): string {
  const background = primary ? COLORS.accent : "#ffffff";
  const color = primary ? COLORS.accentText : COLORS.text;
  const border = primary ? COLORS.accent : COLORS.border;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr>` +
    `<td style="border-radius:8px;background:${background};border:1px solid ${border};">` +
    `<a href="${escapeHtml(link.url)}" style="display:inline-block;padding:12px 22px;font:600 15px/1.2 ${FONT};color:${color};text-decoration:none;border-radius:8px;">${escapeHtml(link.label)}</a>` +
    `</td></tr></table>`
  );
}

/**
 * Teilt den Klartext in Absätze. Mehrabsätzige Hervorhebungen (eine
 * Begründung mit Leerzeilen) bleiben ein Block.
 */
function blocks(text: string, highlight: string[]): string[] {
  const parts = text.split(/\n{2,}/);
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const multi = highlight.find((h) => {
      const count = h.split(/\n{2,}/).length;
      return count > 1 && parts.slice(i, i + count).join("\n\n") === h;
    });
    if (multi) {
      result.push(multi);
      i += multi.split(/\n{2,}/).length - 1;
    } else {
      result.push(parts[i]);
    }
  }
  return result.map((part) => part.trim()).filter(Boolean);
}

export function renderEmailHtml(layout: EmailLayout): string {
  const highlight = (layout.highlight ?? []).filter((h): h is string => Boolean(h?.trim())).map((h) => h.trim());
  const plain = new Set(layout.plain ?? []);
  const body = blocks(layout.text, highlight)
    .map((block) => {
      if (layout.code && block === layout.code) {
        return `<p style="margin:4px 0 20px;"><span style="display:inline-block;padding:12px 20px;background:#f3f4f6;border:1px solid ${COLORS.border};border-radius:8px;font:700 28px/1 Consolas, Menlo, monospace;letter-spacing:6px;color:${COLORS.text};">${escapeHtml(block)}</span></p>`;
      }
      if (highlight.includes(block)) {
        return `<div style="margin:0 0 16px;padding:12px 16px;background:${COLORS.quote};border-left:3px solid ${COLORS.accent};font:15px/1.6 ${FONT};color:${COLORS.text};">${escapeHtml(block).replace(/\n/g, "<br>")}</div>`;
      }
      if (plain.has(block)) {
        return paragraph(escapeHtml(block), "font-family:Consolas, Menlo, monospace;font-size:13px;word-break:break-all;");
      }
      if (layout.cta && block === layout.cta.url) {
        return (
          button(layout.cta, true) +
          paragraph(
            `${escapeHtml(layout.labels.fallback)}<br><a href="${escapeHtml(block)}" style="color:${COLORS.link};word-break:break-all;">${escapeHtml(block)}</a>`,
            `font-size:12px;color:${COLORS.muted};`,
          )
        );
      }
      if (layout.secondary && block === layout.secondary.url) return button(layout.secondary, false);
      if (URL_ONLY.test(block)) {
        return paragraph(`<a href="${escapeHtml(block)}" style="color:${COLORS.link};word-break:break-all;">${escapeHtml(block)}</a>`);
      }
      return paragraph(inline(block));
    })
    .join("\n");

  const preheader = escapeHtml(layout.text.split(/\n{2,}/)[1]?.replace(/\s+/g, " ").slice(0, 140) ?? "");
  const footerLink = (url: string, label: string) =>
    `<a href="${escapeHtml(url)}" style="color:${COLORS.muted};">${escapeHtml(label)}</a>`;

  return `<!doctype html>
<html lang="${escapeHtml(layout.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(layout.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${COLORS.border};">
<tr><td style="background:${COLORS.header};padding:20px 28px;font:700 20px/1.2 ${FONT};color:${COLORS.headerText};">OMSI <span style="color:${COLORS.accent};">Mod Hub</span></td></tr>
<tr><td style="padding:28px 28px 12px;">
${body}
</td></tr>
<tr><td style="background:${COLORS.footer};padding:16px 28px;border-top:1px solid ${COLORS.border};font:12px/1.5 ${FONT};color:${COLORS.muted};">
${escapeHtml(layout.labels.footer)}<br>
${footerLink(layout.links.imprint, layout.labels.imprint)} · ${footerLink(layout.links.privacy, layout.labels.privacy)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
