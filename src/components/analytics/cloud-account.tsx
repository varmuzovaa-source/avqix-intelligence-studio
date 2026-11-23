import { authErrorMessage } from "@/lib/auth-errors";
import { CloudSyncStatus } from "./cloud-sync";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, passwordRecoveryRequested, completePasswordRecovery } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function CloudAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [repeatPassword, setRepeatPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (passwordRecoveryRequested) setRecovery(true);
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setPassword("");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function authenticate(register: boolean) {
    setBusy(true);
    try {
      const { error } = register
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword("");
      setMessage(register ? "Zkontrolujte e-mail a potvrďte registraci." : "Přihlášení proběhlo.");
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="avqix-getting-started" aria-label="Cloudový účet">
      <h2>Cloudový účet AVQIX</h2>
      <p>
        Supabase Free. Klienti, uložené cíle a úkoly se ukládají automaticky. Stav uložení vidíte
        nahoře. Při výpadku připojení zůstávají změny v tomto zařízení a po návratu připojení se
        odešlou.
      </p>
      {recovery ? (
        <form
          className="avqix-start-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== repeatPassword) {
              setMessage("Hesla se neshodují.");
              return;
            }
            setBusy(true);
            try {
              const { error } = await supabase.auth.updateUser({ password });
              if (error) throw error;
              setPassword("");
              setRepeatPassword("");
              completePasswordRecovery();
              setRecovery(false);
              setMessage("Nové heslo je uložené. Jste přihlášená.");
            } catch {
              setMessage(
                "Heslo se nepodařilo uložit. Otevřete nový odkaz pro obnovu a zkuste to znovu.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nové heslo
            <input
              className="w-full border rounded p-2"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Znovu nové heslo
            <input
              className="w-full border rounded p-2"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit">
            Uložit nové heslo
          </Button>
        </form>
      ) : user ? (
        <>
          <p>{user.email}</p>
          <CloudSyncStatus details />
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
              type={showPassword ? "text" : "password"}
              minLength={8}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
          </Button>
          <p>Použijte heslo zvolené při registraci AVQIX. Heslo k vašemu Gmailu sem nepatří.</p>
          <Button
            disabled={busy || !email.trim()}
            type="button"
            variant="outline"
            onClick={async () => {
              setBusy(true);
              try {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
                if (error) throw error;
                setMessage(
                  "Pokud účet existuje, přijde e-mail pro nastavení nového hesla. Otevřete nejnovější zprávu v tomto prohlížeči.",
                );
              } catch {
                setMessage(
                  "E-mail pro obnovu se nepodařilo odeslat. Počkejte chvíli a zkuste to znovu.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Zapomenuté heslo
          </Button>
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
