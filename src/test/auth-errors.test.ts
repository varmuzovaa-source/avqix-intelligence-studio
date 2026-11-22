import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";
describe("auth error guidance", () => {
  it("distinguishes credentials from unconfirmed email", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toContain(
      "E-mail nebo heslo nesouhlasí",
    );
    expect(authErrorMessage({ code: "email_not_confirmed" })).toContain("Nejdříve potvrďte");
  });
  it("does not expose raw server errors", () => {
    expect(authErrorMessage({ message: "private details" })).not.toContain("private details");
    expect(authErrorMessage(null)).toContain("Zkuste");
  });
});
