import { uploadWorkspace, downloadWorkspace } from "@/lib/cloud-workspace";
import { exportWorkspaceBackup, restoreWorkspaceBackup } from "@/lib/workspace-backup";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function CloudAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  async function authenticate(register: boolean) {
    setBusy(true);
    try {
      const { error } = register
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
      setMessage(register ? "Zkontrolujte e-mail a potvrďte registraci." : "Přihlášení proběhlo.");
    } catch {
      setMessage("Přihlášení se nepodařilo. Ověřte e-mail, heslo a potvrzení registrace.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="avqix-getting-started" aria-label="Cloudový účet">
      <h2>Cloudový účet AVQIX</h2>
      <p>
        Supabase Free. Ruční přenos klientů, cílů a přiřazených úkolů. Změny se neukládají
        automaticky; smazání se nepřenáší. Před načtením stáhněte lokální zálohu. Pracujte vždy na
        jednom zařízení.
      </p>
      {user ? (
        <>
          <p>{user.email}</p>
          <Button
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  "Nahrát lokální data do tohoto účtu? Shodné záznamy budou přepsány. Smazání se nepřenáší.",
                )
              )
                return;
              setBusy(true);
              try {
                await uploadWorkspace(exportWorkspaceBackup());
                setMessage("Nahráno.");
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Přenos selhal. Část záznamů může být uložená; přenos lze zopakovat.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Nahrát do cloudu
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            onClick={async () => {
              if (
                !window.confirm(
                  "Nahradit lokální klienty, cíle a úkoly daty přihlášeného účtu? Nejdříve si stáhněte zálohu.",
                )
              )
                return;
              setBusy(true);
              try {
                restoreWorkspaceBackup(await downloadWorkspace());
                window.location.reload();
              } catch {
                setMessage("Načtení selhalo. Lokální data zůstávají zachována.");
                setBusy(false);
              }
            }}
          >
            Načíst z cloudu
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await supabase.auth.signOut();
              setMessage(error ? "Odhlášení se nepodařilo." : "Odhlášeno.");
              setBusy(false);
            }}
          >
            Odhlásit se
          </Button>
        </>
      ) : (
        <form
          className="avqix-start-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void authenticate(false);
          }}
        >
          <label>
            E-mail
            <input
              className="w-full border rounded p-2"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Heslo
            <input
              className="w-full border rounded p-2"
              type="password"
              minLength={8}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit">
            Přihlásit se
          </Button>
          <Button
            disabled={busy || !email || password.length < 8}
            type="button"
            variant="outline"
            onClick={() => void authenticate(true)}
          >
            Vytvořit účet
          </Button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
