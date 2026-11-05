import { describe, expect, it } from "vitest";

import { qrPath } from "@/lib/qr";
import {
  emailOfVerificationToken,
  normalizeBackupCode,
  normalizeTotpCode,
  totpSecretFromUri,
} from "@/lib/two-factor";

const jwt = (payload: unknown) =>
  `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

describe("Zwei-Faktor-Eingaben", () => {
  it("akzeptiert 6-stellige App-Codes, auch mit Leerzeichen", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode(" 012345 ")).toBe("012345");
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("12345a")).toBeNull();
    expect(normalizeTotpCode("abcde-12345")).toBeNull();
  });

  it("normalisiert Backup-Codes und behält die Groß-/Kleinschreibung", () => {
    expect(normalizeBackupCode("aB3dE-x9Z12")).toBe("aB3dE-x9Z12");
    expect(normalizeBackupCode("aB3dEx9Z12")).toBe("aB3dE-x9Z12");
    expect(normalizeBackupCode(" aB3dE-x9Z12 ")).toBe("aB3dE-x9Z12");
    expect(normalizeBackupCode("aB3dE-x9Z1")).toBeNull();
    expect(normalizeBackupCode("aB3dE_x9Z12")).toBeNull();
    expect(normalizeBackupCode("")).toBeNull();
  });

  it("liest das Secret aus der otpauth-URI", () => {
    const uri = "otpauth://totp/OMSI%20Mod%20Hub:a%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=OMSI+Mod+Hub&digits=6&period=30";
    expect(totpSecretFromUri(uri)).toBe("JBSW Y3DP EHPK 3PXP");
    expect(totpSecretFromUri("https://example.com/?secret=JBSWY3DPEHPK3PXP")).toBeNull();
    expect(totpSecretFromUri("otpauth://totp/x?secret=<script>")).toBeNull();
    expect(totpSecretFromUri("kein link")).toBeNull();
  });

  it("liest die Adresse aus dem Bestätigungslink, ohne bei Unsinn zu werfen", () => {
    expect(emailOfVerificationToken(jwt({ email: "Anna@Example.com", updateTo: "neu@example.com" }))).toBe("anna@example.com");
    expect(emailOfVerificationToken(jwt({ other: 1 }))).toBeNull();
    expect(emailOfVerificationToken("a.%%%.c")).toBeNull();
    expect(emailOfVerificationToken("ohne-punkte")).toBeNull();
    expect(emailOfVerificationToken(undefined)).toBeNull();
    expect(emailOfVerificationToken(jwt(null))).toBeNull();
  });
});

describe("QR-Code", () => {
  it("erzeugt einen quadratischen Pfad mit Ruhezone", () => {
    const { size, path } = qrPath("otpauth://totp/OMSI:a%40example.com?secret=JBSWY3DPEHPK3PXP");
    expect(size).toBeGreaterThanOrEqual(21 + 8);
    expect(path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
    // Die Ruhezone (4 Module) bleibt leer: kein Rechteck beginnt in Zeile 0–3.
    expect(path).not.toMatch(/M\d+ [0-3]h/);
  });
});
