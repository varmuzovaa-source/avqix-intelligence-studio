import { useState } from "react";
import { useWorkspace } from "./workspace";
import { clients, isCustomClient } from "@/lib/analytics-data";
import {
  parseChannelReport,
  recommendStrategy,
  buildAdvicePlan,
  channelNames,
  type Channel,
  type ChannelReport,
} from "@/lib/client-strategy";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeading } from "./controls";
import { tasksStore, useTasks } from "@/lib/tasks-store";

const channels: Channel[] = ["ga4", "google_ads", "meta_ads", "email", "reservations"];
const instructions: Record<Channel, string> = {
  ga4: "Export GA4 → Reporty → Akvizice: CSV se sloupcem Sessions / Relace (volitelně Key events a Revenue).",
  google_ads:
    "Google Ads → Kampaně → Stáhnout CSV: Cost / Náklady, Conversions, Clicks, Impressions, Conversion value.",
  meta_ads:
    "Meta Ads Manager → Export CSV: Amount spent, Results, Link clicks, Impressions a případně Purchase conversion value.",
  email:
    "Ecomail / jiný e-mailing → export agregovaných statistik kampaní: Sent, Opens, Clicks, Unsubscribes.",
  reservations:
    "Rezervační systém → souhrnný CSV export: Reservations / Rezervace, Guests / Počet hostů, Cancellations / Storna. Bez jmen, telefonů či e-mailových adres hostů.",
};
const connectionRequirements: Record<
  Channel,
  { access: string; automation: string; credential: string }
> = {
  ga4: {
    access: "Google Analytics 4 → role Čtenář / Viewer + ID GA4 property",
    automation:
      "Google Analytics Data API; bezpečná serverová autorizace přes OAuth / servisní účet",
    credential: "OAuth / servisní účet výhradně na serveru",
  },
  google_ads: {
    access: "Přístup do reklamního účtu (ideálně read-only), Customer ID a případně MCC",
    automation:
      "Google Ads API včetně developer tokenu a Google OAuth, alternativně lokální Fachman",
    credential: "Google OAuth token + developer token (serverové tajemství)",
  },
  meta_ads: {
    access: "Meta Business portfolio, reklamní účet a oprávnění číst Insights",
    automation: "Meta Marketing API, autorizace Business app a systémový uživatel / OAuth",
    credential: "Meta access token (serverové tajemství)",
  },
  email: {
    access: "Ecomail účet s oprávněním pro statistiky kampaní; jiný poskytovatel dle API",
    automation: "Ecomail API nebo zabezpečené stahování agregovaných exportů",
    credential: "API klíč Ecomail (serverové tajemství)",
  },
  reservations: {
    access: "Název rezervačního systému + přístup ke statistikám a souhrnnému exportu",
    automation: "API / webhook, případně naplánovaný anonymizovaný CSV export podle dodavatele",
    credential: "API klíč / webhook secret pouze na serveru",
  },
};
const csvTemplates: Record<Channel, string> = {
  ga4: "sessions,key events,total revenue\\n120,7,3500",
  google_ads: "cost,clicks,impressions,conversions,conversion value\\n1200,145,4000,9,5500",
  meta_ads:
    "amount spent,link clicks,impressions,results,purchase conversion value\\n980,112,5600,7,4200",
  email: "sent,opens,clicks,unsubscribes\\n500,176,25,1",
  reservations: "reservations,guests,cancellations,revenue\\n32,69,2,12600",
};
type SnapshotState = Record<string, Partial<Record<Channel, ChannelReport>>>;
export function StrategyPage() {
  const { client } = useWorkspace();
  const name = clients[client] ?? "";
  const [all, setAll] = useState<SnapshotState>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [objective, setObjective] = useState<"bookings" | "leads" | "sales">("bookings");
  const [priorityFilter, setPriorityFilter] = useState<"Vše" | "Vysoká" | "Střední" | "Nízká">(
    "Vše",
  );
  const [showSetup, setShowSetup] = useState(false);
  const reports = all[name] ?? {};
  const tasks = useTasks();
  const suggestions = recommendStrategy(reports, objective);
  const visibleSuggestions = suggestions.filter(
    (s) => priorityFilter === "Vše" || s.priority === priorityFilter,
  );
  const totalSpend =
    (reports.google_ads?.metrics.spend ?? 0) + (reports.meta_ads?.metrics.spend ?? 0);
  const totalConversions =
    (reports.google_ads?.metrics.conversions ?? 0) + (reports.meta_ads?.metrics.conversions ?? 0);
  const connectedCount = channels.filter((c) => !!reports[c]).length;
  const taskKey = (title: string) => `strategy:${name}:${title}`;
  const sent = (title: string) => tasks.some((task) => task.sourceKey === taskKey(title));
  const plannedDate = (priority: (typeof suggestions)[number]["priority"]) => {
    const date = new Date();
    date.setDate(date.getDate() + (priority === "Vysoká" ? 0 : priority === "Střední" ? 3 : 7));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const addTask = (advice: (typeof suggestions)[number]) =>
    tasksStore.add({
      clientName: name,
      sourceKey: taskKey(advice.title),
      title: advice.title,
      action: advice.action,
      source: `${name} · Strategie · ${reports.ga4 || reports.google_ads || reports.meta_ads || reports.email || reports.reservations ? "CSV data" : "bez importovaných dat"}`,
      recipient: "Marketing",
      impact: advice.explanation,
      priority: advice.priority,
      dueDate: plannedDate(advice.priority),
    });
  const plan = buildAdvicePlan(suggestions);
  const { today, thisWeek, later } = plan;
  const metrics = [
    {
      label: "Investice do reklamy",
      value: totalSpend
        ? totalSpend.toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " *"
        : "—",
      info: "Součet nákladů Google + Meta",
    },
    {
      label: "GA4 relace",
      value: reports.ga4?.metrics.sessions?.toLocaleString("cs-CZ") ?? "—",
      info: "Návštěvnost webu",
    },
    {
      label: objective === "bookings" ? "Rezervace" : "Konverze v reklamách",
      value:
        objective === "bookings"
          ? (reports.reservations?.metrics.reservations?.toLocaleString("cs-CZ") ?? "—")
          : totalConversions
            ? totalConversions.toLocaleString("cs-CZ")
            : "—",
      info:
        objective === "bookings"
          ? "Počet rezervací z rezervačního systému"
          : "Součet vykázaných konverzí, odlišná atribuce",
    },
    {
      label: "E-mailing – odesláno",
      value: reports.email?.metrics.sent?.toLocaleString("cs-CZ") ?? "—",
      info: "Vykázané odeslané e-maily",
    },
  ];
  const importFile = (channel: Channel, file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setErrors((s) => ({ ...s, [channel]: "Použijte CSV soubor." }));
      return;
    }
    void file
      .text()
      .then((csv) => {
        const report = parseChannelReport(channel, csv, file.name);
        setAll((s) => ({ ...s, [name]: { ...s[name], [channel]: report } }));
        setErrors((s) => ({ ...s, [channel]: "" }));
      })
      .catch((error: unknown) =>
        setErrors((s) => ({
          ...s,
          [channel]: error instanceof Error ? error.message : "Import se nezdařil",
        })),
      );
  };
  const exportTemplate = (channel: Channel) => {
    const data = csvTemplates[channel]
      .split(String.fromCharCode(92) + "n")
      .join(String.fromCharCode(10));
    const blob = new Blob([String.fromCharCode(0xfeff) + data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `avqix-vzor-${channel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportStrategy = () => {
    const lines = [
      `AVQIX — Marketingová strategie: ${name}`,
      `Obchodní cíl: ${objective}`,
      `Datum: ${new Date().toLocaleDateString("cs-CZ")}`,
      "",
      "DATOVÉ ZDROJE",
      ...channels.map(
        (c) =>
          `${channelNames[c]}: ${reports[c] ? reports[c]!.fileName + " (" + reports[c]!.updatedAt + ")" : "nenačteno"}`,
      ),
      "",
      "DOPORUČENÍ",
      ...suggestions.flatMap((s, i) => [
        `${i + 1}. [${s.priority}] ${s.title}`,
        s.explanation,
        `Akce: ${s.action}`,
        ...s.steps.map((step, stepIndex) => `  ${stepIndex + 1}. ${step}`),
        `Měřítko úspěchu: ${s.successMetric}`,
        "",
      ]),
      "Poznámka: data jsou agregovaná z jednotlivých exportů. Různá období a atribuční modely nemusí být přímo srovnatelné.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "avqix-strategie.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="page-content">
      <PageHeader
        title="Strategie & integrace"
        description="Jeden přehled GA4, Google Ads, Meta Ads, e-mailingu a rezervací. Doporučení vycházejí z nahraných dat, ne z demo čísel."
      />
      {!isCustomClient(client) && (
        <div className="info-banner">
          Vybraný pracovní prostor je ukázkový. Pro skutečná klientská data vytvořte vlastního
          klienta v sekci Klienti.
        </div>
      )}
      <div className="info-banner">
        Přímé API konektory zatím nejsou zapnuté. Toto je funkční import agregovaných CSV a
        pravidlová strategie. Nahrané soubory se zpracují v prohlížeči, tato stránka je
        nesynchronizuje do cloudu. Po obnovení stránky je nutné nahrát je znovu.
      </div>
      <section className="reco-section strategy-now" aria-labelledby="strategy-now-title">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Doporučený další krok
            </p>
            <h2
              id="strategy-now-title"
              className="text-2xl md:text-3xl font-bold tracking-tight mt-2"
            >
              Co udělat teď
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Nejdůležitější kroky podle zvoleného cíle a aktuálně dostupných souhrnných dat.
            </p>
          </div>
          <span className="rounded-full border px-3 py-1.5 text-xs font-medium">
            {connectedCount ? "Podklad: CSV import" : "Nejdřív přidejte data"}
          </span>
        </div>
        <div className="strategy-priority-grid">
          {today.length ? (
            today.map((s, i) => (
              <article className="strategy-priority-card" key={s.title}>
                <div className="flex items-center justify-between gap-2">
                  <span className="strategy-step">Priorita {i + 1}</span>
                  <span className="strategy-status">{s.priority}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.explanation}</p>
                <p className="strategy-action">
                  <strong>Konkrétně:</strong> {s.action}
                </p>
                <div className="strategy-detail">
                  <strong>Postup krok za krokem</strong>
                  <ol>
                    {s.steps.map((step, stepIndex) => (
                      <li key={step}>
                        {stepIndex + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <p className="strategy-success">
                  <strong>Jak poznat výsledek:</strong> {s.successMetric}
                </p>
                <Button
                  size="sm"
                  variant={sent(s.title) ? "ghost" : "default"}
                  disabled={sent(s.title)}
                  onClick={() => addTask(s)}
                >
                  {sent(s.title) ? "Přidáno do úkolů" : "Přidat do úkolů"}
                </Button>
              </article>
            ))
          ) : (
            <p className="gsc-note">
              Pro tento cíl zatím nejsou naléhavé kroky. Podívejte se na týdenní plán níže.
            </p>
          )}
        </div>
        <div className="strategy-horizon-grid">
          {(
            [
              { title: "Tento týden", items: thisWeek },
              { title: "Později", items: later },
            ] as const
          ).map((group) => (
            <section className="strategy-horizon" key={group.title}>
              <h3>{group.title}</h3>
              {group.items.length ? (
                group.items.map((s) => (
                  <article key={s.title}>
                    <div>
                      <strong>{s.title}</strong>
                      <p>{s.action}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sent(s.title)}
                      onClick={() => addTask(s)}
                    >
                      {sent(s.title) ? "Přidáno" : "Přidat do úkolů"}
                    </Button>
                  </article>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Zatím bez doporučení.</p>
              )}
            </section>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Doporučení vytváří deterministická pravidla nad importovanými souhrny. Nejde o
          automatickou analýzu živých účtů ani o změny v kampaních.
        </p>
      </section>
      <section className="rounded-2xl border border-border/80 bg-card p-5 md:p-7 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              AVQIX / Intelligence overview
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mt-2">
              Marketing pod kontrolou.
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Výkonnost, datové zdroje a doporučené další kroky na jednom místě.
            </p>
          </div>
          <div className="rounded-xl border px-4 py-3 min-w-36">
            <p className="text-xs text-muted-foreground">Načtené datové zdroje</p>
            <strong className="text-3xl tabular-nums">
              {connectedCount}
              <span className="text-base text-muted-foreground"> / 5</span>
            </strong>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${(connectedCount / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {metrics.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-background p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl md:text-2xl font-semibold tabular-nums mt-2">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-2">{kpi.info}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          * Měna je podle exportu. Náklady z různých měn nesčítejte. Importy musí pokrývat stejné
          období.
        </p>
      </section>
      <section className="reco-section">
        <SectionHeading
          title="Obchodní cíl klienta"
          subtitle="Určuje priority marketingových doporučení"
        />
        <label htmlFor="strategy-objective">Optimalizovat na </label>
        <select
          id="strategy-objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value as typeof objective)}
          className="rounded-md border bg-background p-2 ml-2"
        >
          <option value="bookings">Rezervace</option>
          <option value="leads">Poptávky / leady</option>
          <option value="sales">Tržby / prodeje</option>
        </select>
      </section>
      <section className="reco-section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Technická integrace</h2>
            <p className="text-sm text-muted-foreground">
              Přístup a požadavky pro pět marketingových zdrojů
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowSetup((v) => !v)}>
            {showSetup ? "Skrýt technické požadavky" : "Zobrazit technické požadavky"}
          </Button>
        </div>
        {showSetup && (
          <>
            <SectionHeading
              title="Připravenost pro prvního klienta"
              subtitle="Co přichystat k bezpečnému živému napojení. Stav importu neznamená aktivní API."
            />
            <p className="gsc-note">
              Autorizace a přístupové tokeny nikdy nevkládejte do tohoto formuláře, veřejného
              repozitáře ani do CSV. API konektory musí běžet na serveru, s oddělením dat klientů,
              obnovou tokenů a logem synchronizace.
            </p>
            <div className="reco-grid">
              {channels.map((channel) => (
                <article className="reco-card" key={channel}>
                  <h3>{channelNames[channel]}</h3>
                  <p>
                    <strong>Co získat:</strong> {connectionRequirements[channel].access}
                  </p>
                  <p>
                    <strong>Živá synchronizace:</strong>{" "}
                    {connectionRequirements[channel].automation}
                  </p>
                  <p>
                    <strong>Přístupové údaje:</strong> {connectionRequirements[channel].credential}
                  </p>
                  <p>
                    <strong>Import CSV:</strong>{" "}
                    {reports[channel]
                      ? "Otestován importem tohoto souboru"
                      : "Připraven k vyzkoušení"}
                  </p>
                  <p>
                    <strong>API:</strong> Nepřipojeno – vyžaduje autorizaci a skutečný integrační
                    test
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      <SectionHeading
        title="Datové zdroje"
        subtitle={`${channels.filter((c) => !!reports[c]).length} z 5 importováno · klient: ${name}`}
      />
      <div className="connector-grid">
        {channels.map((channel) => (
          <article key={channel} className="connector-card">
            <div className="connector-head">
              <div>
                <strong>{channelNames[channel]}</strong>
                <p>
                  {reports[channel]
                    ? "Načteno " + reports[channel]!.rowCount + " řádků"
                    : "Čeká na první import"}
                </p>
              </div>
            </div>
            <p className="connector-note">{instructions[channel]}</p>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xs text-muted-foreground rounded-full border px-2 py-1">
                API: čeká na autorizaci
              </span>
              <Button size="sm" variant="outline" onClick={() => exportTemplate(channel)}>
                Vzor CSV
              </Button>
            </div>
            <label className="inline-flex flex-col gap-2 text-sm">
              Nahrát CSV
              <input
                aria-label={`CSV ${channelNames[channel]}`}
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={(e) => {
                  importFile(channel, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {errors[channel] && (
              <p role="alert" className="text-destructive">
                {errors[channel]}
              </p>
            )}
            {reports[channel] && (
              <>
                <p className="gsc-note">Soubor: {reports[channel]!.fileName}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {Object.entries(reports[channel]!.metrics).map(([key, value]) => (
                    <span key={key}>
                      {key}: <strong>{Number(value).toLocaleString("cs-CZ")}</strong>
                    </span>
                  ))}
                </div>
              </>
            )}
          </article>
        ))}
      </div>
      <section className="reco-section">
        <SectionHeading
          title="Další příležitosti"
          subtitle="Další pravidlové návrhy pro marketingový plán"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <strong className="text-sm">{suggestions.length} doporučení</strong>
            <p className="text-xs text-muted-foreground">
              {suggestions.filter((s) => s.priority === "Vysoká").length} vysoká priorita · návrhy
              vycházejí z dostupných dat
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["Vše", "Vysoká", "Střední", "Nízká"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={priorityFilter === p ? "default" : "outline"}
                onClick={() => setPriorityFilter(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-background p-4 mb-4">
          <h3 className="text-sm font-semibold">Všechna doporučení podle priority</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Přehled včetně návrhů, které už jsou uvedené v časovém plánu výše.
          </p>
        </div>
        <div className="reco-grid">
          {visibleSuggestions.map((s, i) => (
            <article className="reco-card" key={s.title + i}>
              <p className="text-sm">{s.priority} priorita</p>
              <h3>{s.title}</h3>
              <p>{s.explanation}</p>
              <p>
                <strong>Další krok:</strong> {s.action}
              </p>
              <details className="strategy-details">
                <summary>Zobrazit konkrétní postup a měřítko úspěchu</summary>
                <ol>
                  {s.steps.map((step, stepIndex) => (
                    <li key={step}>
                      {stepIndex + 1}. {step}
                    </li>
                  ))}
                </ol>
                <p>
                  <strong>Jak poznat výsledek:</strong> {s.successMetric}
                </p>
              </details>
              <Button
                size="sm"
                variant="outline"
                disabled={sent(s.title)}
                onClick={() => addTask(s)}
              >
                {sent(s.title) ? "Přidáno do úkolů" : "Přidat do úkolů"}
              </Button>
            </article>
          ))}
        </div>
        <div className="mt-5">
          <Button onClick={exportStrategy}>Exportovat strategii</Button>
        </div>
      </section>
      <p className="gsc-note">
        Pozor: exporty musí pokrývat stejné období a měnu. GA4 tržby a tržby z reklamních platforem
        se nesčítají. Souhrnná data nedokážou sama o sobě prokázat atribuční vliv kampaní. Žádné
        změny v reklamních účtech se neprovádějí.
      </p>
    </main>
  );
}
