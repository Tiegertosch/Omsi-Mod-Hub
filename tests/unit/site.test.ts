import { describe, expect, it } from "vitest";

import { smtpHeloName } from "@/lib/site";

describe("SMTP-Name (EHLO)", () => {
  it("nimmt den Host der Website", () => {
    expect(smtpHeloName("https://omsi-modhub.de")).toBe("omsi-modhub.de");
    expect(smtpHeloName("https://beta.example.com/")).toBe("beta.example.com");
  });

  it("lässt localhost, IP-Adressen und Unsinn weg (nodemailer-Standard)", () => {
    expect(smtpHeloName("http://localhost:3000")).toBeUndefined();
    expect(smtpHeloName("http://127.0.0.1:3000")).toBeUndefined();
    expect(smtpHeloName("kein link")).toBeUndefined();
  });
});
