import { normalizeHeader, parseCsv, parseNumber } from "./csv-import";

export type Channel = "ga4" | "google_ads" | "meta_ads" | "email" | "reservations";
export type Metric =
  | "sessions"
  | "conversions"
  | "spend"
  | "revenue"
  | "clicks"
  | "impressions"
  | "sent"
  | "opens"
  | "unsubscribes"
  | "reservations"
  | "guests"
  | "cancellations";
export type ChannelReport = {
  channel: Channel;
  fileName: string;
  updatedAt: string;
  rowCount: number;
  metrics: Partial<Record<Metric, number>>;
};
export type Advice = {
  priority: "Vysoká" | "Střední" | "Nízká";
  title: string;
  explanation: string;
  action: string;
  steps: string[];
  successMetric: string;
};
export type AdvicePlan = { today: Advice[]; thisWeek: Advice[]; later: Advice[] };
/** Deterministic view of the highest-priority advice; no AI or live account claim. */
export function buildAdvicePlan(advice: Advice[]): AdvicePlan {
  return {
    today: advice.filter((item) => item.priority === "Vysoká").slice(0, 3),
    thisWeek: advice.filter((item) => item.priority === "Střední").slice(0, 3),
    later: advice.filter((item) => item.priority === "Nízká").slice(0, 3),
  };
}
export const channelNames: Record<Channel, string> = {
  ga4: "GA4",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  email: "E-mailing / Ecomail",
  reservations: "Rezervace",
};
const aliases: Record<Channel, Partial<Record<Metric, string[]>>> = {
  ga4: {
    sessions: ["sessions", "relace"],
    conversions: ["key events", "keyevents", "conversions", "konverze"],
    revenue: ["total revenue", "revenue", "trzby"],
  },
  google_ads: {
    spend: ["cost", "cost czk", "naklady", "cena"],
    clicks: ["clicks", "kliknuti"],
    impressions: ["impressions", "zobrazeni"],
    conversions: ["conversions", "konverze"],
    revenue: ["conv value", "conversion value", "hodnota konverzi"],
  },
  meta_ads: {
    spend: ["amount spent", "amount spent czk", "vynalozena castka", "spend", "naklady"],
    clicks: ["link clicks", "clicks", "kliknuti"],
    impressions: ["impressions", "zobrazeni"],
    conversions: ["results", "vysledky", "purchases"],
    revenue: ["purchase conversion value", "revenue", "hodnota nakupu"],
  },
  email: {
    sent: ["sent", "delivered", "odeslano", "doruceno"],
    opens: ["opens", "unique opens", "otevreni"],
    clicks: ["clicks", "unique clicks", "kliknuti"],
    unsubscribes: ["unsubscribes", "odhlaseni"],
    revenue: ["revenue", "trzby"],
  },
  reservations: {
    reservations: ["reservations", "bookings", "rezervace", "pocet rezervaci"],
    guests: ["guests", "covers", "hoste", "pocet hostu", "pocet osob"],
    cancellations: ["cancellations", "cancelled", "canceled", "storna", "zrusene rezervace"],
    revenue: ["revenue", "trzby", "hodnota rezervaci"],
  },
};
const required: Record<Channel, Metric> = {
  ga4: "sessions",
  google_ads: "spend",
  meta_ads: "spend",
  email: "sent",
  reservations: "reservations",
};
export function parseChannelReport(
  channel: Channel,
  csv: string,
  fileName: string,
  updatedAt: string = new Date().toISOString(),
): ChannelReport {
  if (csv.length > 4_000_000) throw new Error("CSV přesahuje limit 4 MB");
  const rows = parseCsv(csv);
  if (rows.length < 2)
    throw new Error("Soubor musí obsahovat hlavičku a alespoň jeden datový řádek");
  const headers = rows[0]!.map(normalizeHeader);
  const columns = Object.entries(aliases[channel]) as [Metric, string[]][];
  const indices = columns
    .map(([metric, names]) => [metric, headers.findIndex((h) => names.includes(h))] as const)
    .filter(([, index]) => index >= 0);
  if (!indices.some(([metric]) => metric === required[channel]))
    throw new Error("Chybí povinná metrika: " + required[channel]);
  const metrics: Partial<Record<Metric, number>> = {};
  let count = 0;
  for (const row of rows.slice(1)) {
    let found = false;
    for (const [metric, index] of indices) {
      const raw = row[index]?.replace(/\b(CZK|Kč|EUR|USD)\b/gi, "").trim();
      const n = parseNumber(raw);
      if (Number.isFinite(n) && n >= 0) {
        metrics[metric] = (metrics[metric] ?? 0) + n;
        found = true;
      }
    }
    if (found) count++;
  }
  if (!count) throw new Error("Soubor neobsahuje čitelné číselné metriky");
  return { channel, fileName: fileName.slice(0, 150), updatedAt, rowCount: count, metrics };
}
const goalHasRevenue = (goal: "bookings" | "leads" | "sales") => goal === "sales";
export function recommendStrategy(
  reports: Partial<Record<Channel, ChannelReport>>,
  objective: "bookings" | "leads" | "sales" = "bookings",
): Advice[] {
  const advice: Advice[] = [];
  const add = (
    priority: Advice["priority"],
    title: string,
    explanation: string,
    action: string,
    steps: string[],
    successMetric: string,
  ) => advice.push({ priority, title, explanation, action, steps, successMetric });
  const adSpend = (reports.google_ads?.metrics.spend ?? 0) + (reports.meta_ads?.metrics.spend ?? 0);
  if (!Object.keys(reports).length)
    add(
      "Vysoká",
      "Načíst data",
      "Bez skutečných čísel nelze navrhnout měřitelnou strategii.",
      "Importujte report GA4 a alespoň jednoho placeného kanálu.",
      [
        "Vyberte jedno uzavřené období, například posledních 30 dní.",
        "Z GA4 exportujte relace a klíčové události; z reklamního účtu náklady a konverze.",
        "Pokud cílem jsou rezervace, přidejte souhrn rezervací a storen za stejné období.",
      ],
      "Všechny porovnávané exporty mají stejné období a měnu; rezervační cíl má skutečný počet rezervací.",
    );
  if (adSpend > 0 && !reports.ga4)
    add(
      "Vysoká",
      "Ověřit dopad reklamy",
      "Reklamní náklady existují, ale chybí data o návštěvnosti.",
      "Doplňte GA4 za stejné období a ověřte UTM.",
      [
        "V GA4 otevřete Akvizice → Získávání návštěvnosti a nastavte období shodné s reklamním exportem.",
        "Rozdělte data podle session source / medium a zkontrolujte google / cpc a facebook / paid.",
        "U reklamních odkazů doplňte jednotné UTM: source, medium, campaign; ověřte je testovacím klikem.",
      ],
      "Placená návštěvnost je v GA4 rozpoznatelná podle UTM; rozdíl proti reklamnímu kliknutí se dá vysvětlit souhlasem a atribucí.",
    );
  if (reports.ga4 && reports.ga4.metrics.conversions === undefined)
    add(
      "Vysoká",
      "Zkontrolovat měření konverzí",
      "GA4 export nemá klíčové události.",
      "Zaveďte nebo ověřte měření formulářů a dokončených rezervací.",
      [
        "Sepište 1–3 obchodní výsledky, například odeslání poptávky nebo potvrzenou rezervaci.",
        "V GA4 DebugView ověřte, že se událost spouští jednou po dokončení akce, ne při pouhém otevření formuláře.",
        "Označte potvrzené události jako key events a po 24 hodinách ověřte jejich příchod do reportu.",
      ],
      "Testovací akce vytvoří jednu správně pojmenovanou key event bez duplicit.",
    );
  if (objective === "bookings" && !reports.reservations)
    add(
      "Vysoká",
      "Doplnit skutečné rezervace",
      "Počet rezervací a storna nelze vyhodnotit.",
      "Importujte agregovaný export rezervací za stejné období.",
      [
        "V rezervačním systému zvolte přesné datum od–do odpovídající GA4 a reklamním exportům.",
        "Exportujte pouze souhrn: počet rezervací, hostů, storen a případně tržby; osobní údaje vynechte.",
        "Zkontrolujte, zda jde o vytvořené, nebo dokončené rezervace, a poznamenejte si definici do reportu.",
      ],
      "Počet rezervací a storen je z agregovaného systému a období se shoduje s dalšími zdroji.",
    );
  const booked = reports.reservations?.metrics.reservations ?? 0;
  const cancelled = reports.reservations?.metrics.cancellations;
  if (booked > 0 && cancelled !== undefined && cancelled / booked >= 0.15)
    add(
      "Vysoká",
      "Omezit storna",
      `Storno poměr je ${((100 * cancelled) / booked).toFixed(1)} %.`,
      "Otestujte připomínky rezervací, potvrzovací zprávy a podmínky rušení.",
      [
        "Ověřte, že export počítá storna i rezervace se stejnou definicí a stejným obdobím.",
        "Rozdělte storna podle dne rezervace a času do návštěvy, pokud to systém umí bez osobních údajů.",
        "Na příštích 30 dní zaveďte potvrzení rezervace a připomínku 24–48 hodin před termínem.",
      ],
      "Porovnejte podíl storen s předchozím srovnatelným obdobím; cílem je pokles bez zhoršení počtu rezervací.",
    );
  if (adSpend > 0 && booked > 0 && objective === "bookings")
    add(
      "Střední",
      "Sledovat orientační náklad na rezervaci",
      `Reklamní výdaje / všechny rezervace = ${(adSpend / booked).toFixed(1)}. Nejde o atribučně očištěné CPA.`,
      "Zaveďte UTM a deduplikaci měření; srovnávejte stejná období.",
      [
        "Zkontrolujte, že reklamní náklady i rezervace pokrývají shodné dny a stejnou měnu.",
        "Označte kampaně UTM a sledujte potvrzenou rezervaci jako jednu key event.",
        "Příští týden porovnejte trend tohoto orientačního poměru s GA4 kampaněmi; nepovažujte ho za CPA.",
      ],
      "Každý týden je možné srovnat stejným způsobem náklady, rezervace a GA4 key events; atribuci uvádějte zvlášť.",
    );
  for (const channel of ["google_ads", "meta_ads"] as const) {
    const m = reports[channel]?.metrics;
    if (m?.spend && m.conversions === undefined)
      add(
        "Střední",
        `Doplnit konverze v ${channelNames[channel]}`,
        "Náklady jsou známé, konverze chybí.",
        "Zkontrolujte export a měřicí události před změnou rozpočtu.",
        [
          "Ověřte, že export zahrnuje správný účet, kampaně a datum; zkontrolujte sloupec Conversions / Results.",
          "Proveďte testovací konverzi a ověřte ji v reklamní platformě i GA4, včetně zpoždění reportu.",
          "Poznamenejte si rozdíly v atribuci; rozpočet ponechte beze změny, dokud nejsou data ověřena.",
        ],
        "Konverzní akce je správně nakonfigurovaná a po době zpracování se objeví v odpovídajícím reportu.",
      );
    if (m?.spend && m.conversions === 0)
      add(
        "Vysoká",
        `Prověřit ${channelNames[channel]} bez konverzí`,
        "Kampaně mají náklady a nulové vykázané konverze.",
        "Ověřte tracking a sestavy; rozpočty automaticky neměňte.",
        [
          "Ověřte období, stav kampaně, cílovou stránku a to, zda report zobrazuje všechny konverzní akce.",
          "Proveďte kontrolní průchod formulářem nebo rezervací na mobilu i počítači.",
          "Zkontrolujte hledané dotazy nebo publikum, kreativní sdělení a návaznost vstupní stránky.",
        ],
        "Testovací konverze se zaznamená a po ověření dat je jasné, zda problém vzniká v měření nebo v kampani.",
      );
  }
  const email = reports.email?.metrics;
  if (email?.sent && email.clicks !== undefined && email.clicks / email.sent < 0.01)
    add(
      "Střední",
      "Zvýšit prokliky z e-mailů",
      `CTR je ${((100 * email.clicks) / email.sent).toFixed(2)} %.`,
      "Testujte segmentaci, hlavní CTA a obsah po jednotlivých kampaních.",
      [
        "V Ecomailu seřaďte kampaně podle prokliků na doručený e-mail; agregovaný součet může skrývat rozdíly.",
        "Vyberte jednu kampaň a zkontrolujte, zda je hlavní nabídka v předmětu, úvodu i CTA stejná.",
        "Připravte dvě varianty CTA nebo segmentu a pošlete je srovnatelným skupinám; měňte vždy jednu věc.",
      ],
      "V následujících srovnatelných kampaních se zvýší podíl unikátních prokliků na doručený e-mail.",
    );
  const sessions = reports.ga4?.metrics.sessions;
  const keyEvents = reports.ga4?.metrics.conversions;
  if (sessions && sessions >= 100 && keyEvents !== undefined && keyEvents / sessions < 0.01)
    add(
      "Vysoká",
      "Zlepšit konverzní cestu",
      `GA4 vykazuje ${((100 * keyEvents) / sessions).toFixed(2)} klíčových událostí na 100 relací; nejde automaticky o konverzní poměr uživatelů.`,
      "Ověřte definici key events, rychlost webu, formuláře a průchod rezervací. A/B testujte vstupní stránku.",
      [
        "V GA4 rozbijte relace a key events podle landing page a source / medium; nejprve ověřte objem jednotlivých stránek.",
        "Na stránce s návštěvností projděte mobilní formulář nebo rezervaci a zapište místa, kde uživatel váhá nebo narazí na chybu.",
        "Zvolte jednu úpravu s nejmenším nákladem, například viditelnější CTA nebo kratší formulář, a změnu otestujte.",
      ],
      "Upravená stránka zlepší podíl relevantních dokončených akcí při srovnatelném zdroji a období; ověřte objem vzorku.",
    );
  if (sessions && sessions >= 100 && keyEvents !== undefined && keyEvents / sessions >= 0.05)
    add(
      "Nízká",
      "Rozšířit úspěšné vstupní stránky",
      "Poměr klíčových událostí k relacím je relativně vysoký, závisí však na jejich definici.",
      "Rozdělte report GA4 podle landing page a zdroje. Navyšujte rozpočet teprve po kontrole kvality událostí.",
      [
        "Najděte landing pages a kampaně, které přivádějí nejvíce relevantních key events.",
        "Ručním testem ověřte, že událost opravdu znamená poptávku, nákup nebo dokončenou rezervaci.",
        "Připravte variantu úspěšného sdělení pro podobný segment; rozpočet zvyšujte až po ověření kvality leadů či rezervací.",
      ],
      "Úspěšný vzorec přinese kvalitní obchodní výsledky i v dalším období; samotný poměr událostí nestačí.",
    );
  if (email?.sent && email.unsubscribes !== undefined && email.unsubscribes / email.sent > 0.005)
    add(
      "Vysoká",
      "Prověřit odhlašování z e-mailů",
      `Odhlášení tvoří ${((email.unsubscribes / email.sent) * 100).toFixed(2)} % odeslaných e-mailů.`,
      "Zkontrolujte souhlasy, frekvenci rozesílek, segmentaci a relevance obsahu.",
      [
        "Zkontrolujte, zda se míra odhlášení počítá ze stejného počtu doručených e-mailů a porovnejte ji po kampaních.",
        "U kampaní s vyšším odhlašováním ověřte segment, souhlas, frekvenci a shodu obsahu s příslibem při registraci.",
        "Upravte jednu příčinu, například frekvenci pro daný segment, a sledujte další dvě rozesílky.",
      ],
      "Míra odhlášení u srovnatelných kampaní klesne a míra stížností na spam se nezvýší.",
    );
  if (email?.sent && email.opens !== undefined && email.opens / email.sent < 0.15)
    add(
      "Střední",
      "Zkontrolovat doručitelnost",
      `Orientační míra otevření je ${((100 * email.opens) / email.sent).toFixed(1)} %; může být zkreslena ochranou soukromí.`,
      "Prověřte SPF, DKIM, DMARC, reputaci domény, segmenty a výkon prokliků.",
      [
        "V administraci domény ověřte SPF, DKIM a DMARC; případné změny DNS potvrďte s vlastníkem domény.",
        "V Ecomailu zkontrolujte bounce rate a prokliky; open rate berte jen jako orientační kvůli ochraně soukromí.",
        "Omezte neaktivní nebo neplatné kontakty podle pravidel souhlasů a sledujte doručitelnost dalších kampaní.",
      ],
      "Klesá počet nedoručených zpráv a stabilizují se prokliky; samotná otevření nejsou spolehlivým cílem.",
    );
  if (reports.google_ads && reports.meta_ads)
    add(
      "Střední",
      "Srovnat efektivitu kanálů",
      "K dispozici jsou výsledky Google Ads i Meta Ads, ale jejich atribuce se může překrývat.",
      "Vytvořte jednotné UTM, pojmenujte konverze a srovnejte kanály s GA4 a CRM / rezervacemi.",
      [
        "Sjednoťte názvy kampaní a UTM šablonu v Google Ads i Meta Ads.",
        "Zkontrolujte, že stejný obchodní výsledek není v jednom systému započtený vícekrát.",
        "Porovnejte náklady a kliknutí s GA4 relacemi a agregovanými rezervacemi zvlášť; nepřičítejte platformní tržby k GA4.",
      ],
      "Týdenní report ukazuje stejné období, měnu a definici konverze pro oba kanály a označuje rozdíly atribuce.",
    );
  if (reports.ga4 && reports.email && goalHasRevenue(objective))
    add(
      "Střední",
      "Propojit akviziční a retenční výkon",
      "Jsou dostupná data webu a e-mailingu, ale bez společné identity objednávek nelze přesně připsat tržby.",
      "Označte e-mailové odkazy UTM a měřte retenci a opakované nákupy v souladu se souhlasy.",
      [
        "Přidejte UTM campaign do e-mailových odkazů a vyhněte se osobním údajům v URL.",
        "V GA4 porovnejte e-mailové relace a key events; tržby z e-mailu vykazujte jako atribuční pohled platformy.",
        "Pokud je dostupný, porovnejte agregovaný počet opakovaných nákupů z e-shopu, nikoli identitu jednotlivých příjemců.",
      ],
      "Je vidět trend návštěvnosti a výsledků z e-mailových UTM bez tvrzení, že souhrny dokazují příčinu nákupu.",
    );
  if (objective === "bookings" && reports.reservations && !reports.ga4)
    add(
      "Střední",
      "Měřit dokončenou rezervaci",
      "Rezervace evidujeme, ale chybí pohled na cestu návštěvníka.",
      "Nastavte event booking_complete a propojte jej s potvrzovací stránkou bez osobních údajů.",
      [
        "S dodavatelem rezervačního systému ověřte, zda lze bezpečně měřit zobrazení potvrzení bez dat hosta.",
        "Nastavte booking_complete až po úspěšném potvrzení, ne po kliknutí na tlačítko.",
        "Proveďte testovací rezervaci, zkontrolujte jednu událost v DebugView a následně ji stornujte podle testovacího postupu.",
      ],
      "Jedna potvrzená testovací rezervace vytvoří právě jednu GA4 událost bez jména, e-mailu či telefonu.",
    );
  if (objective === "bookings" && booked > 0 && !reports.email)
    add(
      "Nízká",
      "Nastavit retenční e-mailing",
      "Rezervace existují, ale nejsou data o návratu hostů.",
      "S potřebným souhlasem připravte follow-up a nabídku opakované návštěvy.",
      [
        "Zjistěte, zda rezervační systém nebo Ecomail dovoluje pracovat se souhlasem pro marketingové zprávy.",
        "Připravte jeden užitečný follow-up po návštěvě s jasným odhlášením a bez sdílení údajů mimo schválené systémy.",
        "Otestujte malý segment se souhlasem a sledujte prokliky a nové rezervace v agregátu.",
      ],
      "Testovací rozesílka je odeslána pouze kontaktům s platným souhlasem a její výsledky jsou měřitelné agregovaně.",
    );
  if (!advice.length)
    add(
      "Nízká",
      "Týdenní kontrola výkonu",
      "Na dostupných agregovaných datech není jednoznačný varovný signál.",
      "Doplňte cíle KPI a porovnávejte stejná období.",
      [
        "Vyberte jeden hlavní obchodní cíl a nejvýše tři podpůrné KPI.",
        "Zaznamenejte výchozí hodnotu, cílovou hodnotu, období a zdroj každé metriky.",
        "Na konci týdne doplňte výsledek a rozhodněte, zda pokračovat, upravit test, nebo ho ukončit.",
      ],
      "Každý aktivní marketingový krok má vlastníka, termín, výchozí hodnotu a předem určené měřítko.",
    );
  return advice.sort(
    (a, b) =>
      ({ Vysoká: 0, Střední: 1, Nízká: 2 })[a.priority] -
      { Vysoká: 0, Střední: 1, Nízká: 2 }[b.priority],
  );
}
