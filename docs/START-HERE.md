# AVQIX — začni tady (praktický provoz)

Verze 2026-11-22. Tyto instrukce jsou pro již existující projekt AVQIX, ne pro nový produkt.

## Co lze používat hned
- [Ukázkové demo](https://avqix-intelligence-studio.vercel.app) — vizuální prohlídka na **vymyšlených datech**, ne produkční analytika.
- **Lokální AVQIX na Macu** — vlastní klienti, cíle, porovnání metrik, import souborů, pravidlová doporučení, úkoly a export reportu.
- **Fachman** — volitelný read-only most do Google Ads / Meta Ads, jen pokud jsou na Macu nastavené jeho přístupy.

## Nejjednodušší postup bez přístupů k reklamním účtům
1. Na počítači otevři projekt `avqix-intelligence-studio`. Pokud ho na počítači nemáš, stáhni repozitář jako ZIP z GitHubu a rozbal jej.
2. Nainstaluj Node.js, pokud není nainstalován. V Terminálu ve složce projektu spusť `npm install` (poprvé) a `./start.sh`. Na Macu lze spouštět také `Spustit-AVQIX.command`.
3. Otevři `http://localhost:5173`.
4. Přejdi na **Klienti** a přidej svůj reálný testovací projekt (například interní vlastní web; klient může mít zatím prázdná data).
5. Na **Cíle a rady** nastav cíl a KPI. Nevyplňuj vymyšlenou skutečnost.
6. Na **Datové zdroje** nahraj podporovaný CSV export z Search Console nebo e-mailového nástroje; na stránce **Search Console** zkontroluj příležitosti. Kampaně Meta/Google lze importovat ve formátu Fachman JSON.
7. Na **Úkoly** předej doporučení a na **Reporty** připrav klientský export. Označ, odkud pocházejí data.

**Bez účtů Fly Vista** pracuj jen se svými testovacími daty a veřejným webem. Přihlášení k reklamním účtům zprostředkuje až vlastník účtu a žádná integrace není aktivní pouze proto, že je uvedená v seznamu.

## Důležitá omezení
- Systém není zatím produkční cloudová agenturní aplikace: klienti a cíle jsou uloženy v konkrétním prohlížeči; marketingová čísla mohou být jen v paměti.
- Browser data nejsou cloudová záloha; pro práci na více zařízeních nestačí.
- Přímé API Meta/Google na Vercelu v demo aplikaci zatím není. Lokální Fachman vyžaduje skripty a oprávnění.
- Doporučení jsou převážně deterministická pravidla, ne plnohodnotný samostatný generativní agent.
- Neukládej API klíče, tokeny, hesla nebo reálná citlivá klientská data do veřejného dema, GitHub issues či repozitáře.
- Pro firemní produkční provoz je nutné vyřešit autentizaci, oddělení klientských dat, bezpečné API, backend databázi, synchronizace a zálohy.

## Doporučené dokončení (v tomto pořadí)
### Fáze A — UI a důvěra (bez klientských přístupů)
- Aplikovat `docs/DESIGN-SYSTEM-v1.md` na současné komponenty.
- Opravit matoucí onboarding / prázdné stavy / názvy zdrojů.
- Test desktop 1440 a mobil 375px, klávesnici a kontrasty.
- Přesný rozdíl mezi demo, CSV a živými daty.

### Fáze B — produktová data
- Supabase: autentizace, klienti, cíle, úkoly, import history; RLS per user/team/client.
- Migrace z localStorage, export a bezpečné zálohy.
- Bezpečnostní testy, oddělení klientských účtů.

### Fáze C — zdroje a doporučení
- Read-only OAuth/API integrace GA4, GSC, Meta Ads, Google Ads nebo zprostředkovatel; synchronizační úlohy, čerstvost, chyby, atribuce.
- Rezervace/POS a e-mailing podle toho, jaké systémy skutečně používá klient.
- AI doporučení s citací dat, pravidly kvality, možností schválení; žádné autonomní změny rozpočtu.

### Fáze D — provoz
- Staging preview a QA testy, nákladový monitoring, logování, alerty a souhlasy.
- Teprve potom propojit s klienty a případně komerčně nabízet.

## K čemu použít ChatGPT
- „Otevři repo `varmuzovaa-source/avqix-intelligence-studio`, projdi design system, navrhni jeden bezpečný krok na samostatné větvi, proveď testy a dej preview. Nesahej na main.“
- „Zkontroluj existující importy a označ každou metriku DEMO / CSV / LIVE. Nic neposílej třetím stranám.“
- „Udělej pro klienta plán KPI, aby jeho obor rozhodoval o tom, která data jsou na dashboardu první.“

## WordPress mimo AVQIX
WordPress konektor v ChatGPT je pro WordPress weby. AVQIX není WordPress web. Ve WordPressu se design systém používá přes Elementor Site Settings (Global Colors / Global Fonts), případně blokové téma, nikoli skrze propojení GitHub → WordPress.
