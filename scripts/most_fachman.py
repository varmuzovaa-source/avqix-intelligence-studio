#!/usr/bin/env python3
"""Lokální datový most: Fachman (jen čtení) -> složka data-most -> AVQIX.

Použití (ze složky avqix-intelligence-studio):
  python3 scripts/most_fachman.py <klient> --google 123-456-7890 [--meta act_123456] [--dny 30]

Jen standardní knihovna Pythonu. Fachmana nijak nemění: spustí jeho skripty
scripts/google_ads/fetch.py (report campaigns_daily) a scripts/meta/fetch.py (insights po dnech), obojí jen čtení a výstup uloží k nám.
Tajné soubory (.env) nečte. Jede sériově, ať neblokujeme API.
"""
import argparse, datetime, os, re, subprocess, sys
from pathlib import Path

PPC = Path(os.environ.get("FACHMAN_DIR", str(Path.home() / "AGENTURA" / "PPC"))).expanduser()
OUT = Path(__file__).resolve().parent.parent / "data-most"


def spust(prikaz: list[str]) -> str:
    try:
        vysledek = subprocess.run(prikaz, cwd=PPC, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        sys.exit("Fachman překročil limit 3 minut. Zkontrolujte připojení a stav reklamního API.")
    except FileNotFoundError as chyba:
        sys.exit(f"Nepodařilo se spustit skript Fachmana: {chyba.filename}")
    if vysledek.returncode != 0:
        sys.exit("Fachman skončil chybou (nic se neuložilo):\n" + vysledek.stderr.strip()[-800:])
    return vysledek.stdout


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("klient", help="krátký název klienta (složka v AGENTURA/klienti)")
    p.add_argument("--google", help="Google Ads customer ID, např. 123-456-7890")
    p.add_argument("--meta", help="Meta ad účet, např. act_123456")
    p.add_argument("--dny", type=int, default=30, choices=[7, 30, 90], help="délka období (7, 30 nebo 90)")
    a = p.parse_args()
    if not (a.google or a.meta):
        p.error("Zadej aspoň --google nebo --meta.")
    if not re.fullmatch(r"[a-z0-9-]+", a.klient):
        p.error("Název klienta smí obsahovat jen malá písmena, čísla a pomlčky.")
    if a.google and not re.fullmatch(r"\d{3}-?\d{3}-?\d{4}", a.google):
        p.error("Google Ads ID musí obsahovat 10 číslic, například 123-456-7890.")
    if a.meta and not re.fullmatch(r"act_\d{5,}", a.meta):
        p.error("Meta Ads ID musí mít tvar act_123456.")
    if not PPC.is_dir():
        sys.exit(f"Složku Fachmana jsem nenašla: {PPC}. Nastavte FACHMAN_DIR nebo ověřte instalaci.")
    py = next((candidate for candidate in (PPC / ".venv" / "bin" / "python", PPC / ".venv" / "bin" / "python3") if candidate.exists()), None)
    if py is None:
        sys.exit(f"Nenašla jsem Python prostředí Fachmana v {PPC}/.venv. Nejdřív nastavte Fachmana.")
    dnes = datetime.date.today().isoformat()
    pripravene = []
    if a.google:
        text = spust([str(py), "scripts/google_ads/fetch.py", a.google, "campaigns_daily", "--days", str(a.dny)])
        f = OUT / f"{a.klient}-google-ads-{a.dny}d-{dnes}.json"
        pripravene.append((f, text))
    if a.meta:
        text = spust([str(py), "scripts/meta/fetch.py", "insights", a.meta, "--level", "campaign", "--days", str(a.dny), "--params", "time_increment=1"])
        f = OUT / f"{a.klient}-meta-ads-{a.dny}d-{dnes}.json"
        pripravene.append((f, text))
    OUT.mkdir(exist_ok=True)
    ulozeno = []
    for f, text in pripravene:
        temp = f.with_suffix(f.suffix + ".tmp")
        temp.write_text(text, encoding="utf-8")
        temp.replace(f)
        ulozeno.append(f)
    print("Hotovo. Uloženo:")
    for f in ulozeno:
        print("SOUBOR:", f)
    print("Teď v AVQIX: Datové zdroje -> Fachman -> Vybrat soubory z data-most.")


if __name__ == "__main__":
    main()
