import { ArrowUpRight, Database, FolderPlus, SearchCheck, Target } from 'lucide-react';

const steps = [
  {
    href: '/klienti',
    icon: FolderPlus,
    title: '1. Přidejte svého klienta',
    description: 'Vytvořte klienta podle typu podnikání. Bez účtu v reklamních systémech můžete začít hned.',
    action: 'Otevřít klienty',
  },
  {
    href: '/cile',
    icon: Target,
    title: '2. Zadejte obchodní cíl',
    description: 'Vyberte KPI a cíl. Pokud ještě nemáte výsledky, nechte je prázdné — AVQIX je nebude vymýšlet.',
    action: 'Nastavit cíle',
  },
  {
    href: '/search-console',
    icon: SearchCheck,
    title: '3. Nahrajte první skutečná data',
    description: 'Import CSV ze Search Console umí vyhodnotit SEO příležitosti. Alternativně lze níže importovat e-mailové výsledky nebo Fachman JSON.',
    action: 'Import SEO dat',
  },
  {
    href: '/ukoly',
    icon: Database,
    title: '4. Převeďte doporučení do úkolů',
    description: 'Uložte doporučené kroky. Data se zatím ukládají lokálně v tomto prohlížeči, nikoliv do společného cloudu.',
    action: 'Otevřít úkoly',
  },
] as const;

/** Actionable first-run guide; all links work without connecting external marketing accounts. */
export function GettingStarted() {
  return (
    <section className="avqix-getting-started" aria-labelledby="avqix-start-title">
      <div className="avqix-getting-started-head">
        <div>
          <p className="avqix-kicker">RYCHLÝ START</p>
          <h2 id="avqix-start-title">Začněte pracovat i bez připojených účtů</h2>
          <p>Čtyři konkrétní kroky, které můžete dokončit už dnes.</p>
        </div>
        <span className="avqix-demo-warning">Bez živé synchronizace</span>
      </div>
      <div className="avqix-start-grid">
        {steps.map(({ href, icon: Icon, title, description, action }) => (
          <article className="avqix-start-card" key={href}>
            <Icon size={20} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{description}</p>
            <a href={href}>{action}<ArrowUpRight size={15} aria-hidden="true" /></a>
          </article>
        ))}
      </div>
    </section>
  );
}
