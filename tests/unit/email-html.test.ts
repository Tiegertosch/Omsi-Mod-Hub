import { describe, expect, it, vi } from "vitest";

import { escapeHtml, renderEmailHtml, type EmailLayout } from "@/lib/email-html";

vi.mock("server-only", () => ({}));

const base: EmailLayout = {
  locale: "de",
  subject: "Betreff",
  text: "Hallo Anna,\n\nerster Absatz.",
  labels: { fallback: "Falls der Button nicht geht:", footer: "Automatisch verschickt.", imprint: "Impressum", privacy: "Datenschutz" },
  links: { imprint: "https://example.com/de/legal/imprint", privacy: "https://example.com/de/legal/privacy" },
};

describe("HTML-Mails", () => {
  it("escaped alle Texte, auch Begründungen und Betreff", () => {
    const html = renderEmailHtml({
      ...base,
      subject: "<b>Titel</b>",
      text: "Hallo <script>alert(1)</script>,\n\nBegründung:\n\n<img src=x onerror=alert(1)>",
      highlight: ["<img src=x onerror=alert(1)>"],
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>Titel");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("macht den Hauptlink zum Button mit Ersatzlink, weitere Links zu einfachen Links", () => {
    const html = renderEmailHtml({
      ...base,
      text: "Hallo,\n\nhier entlang:\n\nhttps://example.com/go\n\nOder hier:\n\nhttps://example.com/other",
      cta: { url: "https://example.com/go", label: "Weiter" },
    });
    expect(html).toMatch(/<a href="https:\/\/example\.com\/go"[^>]*>Weiter<\/a>/);
    expect(html).toContain("Falls der Button nicht geht:");
    expect(html).toMatch(/<a href="https:\/\/example\.com\/other"[^>]*>https:\/\/example\.com\/other<\/a>/);
  });

  it("zeigt den Code groß und markierte Adressen ohne Link", () => {
    const html = renderEmailHtml({
      ...base,
      text: "Hallo,\n\ndein Code:\n\n123456\n\nGesperrter Link:\n\nhttps://evil.example/file.exe",
      code: "123456",
      plain: ["https://evil.example/file.exe"],
    });
    expect(html).toMatch(/letter-spacing:6px[^>]*>123456</);
    expect(html).not.toContain('href="https://evil.example');
    expect(html).toContain("https://evil.example/file.exe");
  });

  it("hält eine Begründung mit Leerzeilen als einen Kasten zusammen", () => {
    const note = "Erster Punkt.\n\nZweiter Punkt.";
    const html = renderEmailHtml({ ...base, text: `Hallo,\n\nBegründung:\n\n${note}\n\nDanke.`, highlight: [note, null, ""] });
    expect(html).toContain("Erster Punkt.<br><br>Zweiter Punkt.");
    expect(html.match(/border-left:3px/g)).toHaveLength(1);
  });

  it("enthält Fußzeile mit Impressum und Datenschutz", () => {
    const html = renderEmailHtml(base);
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('href="https://example.com/de/legal/imprint"');
    expect(html).toContain('href="https://example.com/de/legal/privacy"');
    expect(html).toContain("OMSI <span");
  });
});

describe("E-Mails mit HTML-Fassung", () => {
  it("liefern Klartext und gestaltetes HTML mit escapter Begründung", async () => {
    const { projectDecisionEmail, verificationCodeEmail } = await import("@/server/emails");
    const user = { email: "c@example.com", name: "Chris", preferredLocale: "de" };
    const project = { id: "p1", slug: "gelenkbus", title: "Gelenkbus <GL18>" };

    const hidden = projectDecisionEmail(user, project, "hide", "Link <b>defekt</b>.", {
      token: "a".repeat(43),
      until: new Date("2027-05-01T10:00:00Z"),
    });
    expect(hidden.text).toContain("Link <b>defekt</b>.");
    expect(hidden.html).toContain("Link &lt;b&gt;defekt&lt;/b&gt;.");
    expect(hidden.html).toContain(">Zum Dashboard</a>");
    expect(hidden.html).toContain(">Widerspruch einlegen</a>");
    expect(hidden.html).not.toContain("<GL18>");

    const code = verificationCodeEmail(user, "482913", 15);
    expect(code.html).toMatch(/letter-spacing:6px[^>]*>482913</);
    expect(code.html).toContain(">Code eingeben</a>");
  });
});
