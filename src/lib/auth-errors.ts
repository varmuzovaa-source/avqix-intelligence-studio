/** Keep provider details out of the UI while preserving actionable auth failures. */
export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "invalid_credentials")
    return "E-mail nebo heslo nesouhlasí. Zadejte heslo vytvořené pro AVQIX, nikoli heslo ke Gmailu. Můžete ho zkontrolovat tlačítkem Zobrazit heslo.";
  if (code === "email_not_confirmed")
    return "Nejdříve potvrďte e-mail od AVQIX. Po potvrzení se vraťte sem a přihlaste se.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit")
    return "Příliš mnoho pokusů. Chvíli počkejte a zkuste to znovu.";
  if (code === "weak_password") return "Zvolte silnější heslo, alespoň 8 znaků.";
  return "Připojení nebo přihlášení se nepodařilo. Zkuste to znovu za chvíli. Pokud problém trvá, kontaktujte správce.";
}
