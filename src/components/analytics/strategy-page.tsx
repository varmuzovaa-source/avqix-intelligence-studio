import { useState } from 'react';
import { useWorkspace } from './workspace';
import { clients, isCustomClient } from '@/lib/analytics-data';
import { parseChannelReport, recommendStrategy, channelNames, type Channel, type ChannelReport } from '@/lib/client-strategy';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionHeading } from './controls';

const channels: Channel[]=['ga4','google_ads','meta_ads','email','reservations'];
const instructions:Record<Channel,string>={
ga4:'Export GA4 → Reporty → Akvizice: CSV se sloupcem Sessions / Relace (volitelně Key events a Revenue).',
google_ads:'Google Ads → Kampaně → Stáhnout CSV: Cost / Náklady, Conversions, Clicks, Impressions, Conversion value.',
meta_ads:'Meta Ads Manager → Export CSV: Amount spent, Results, Link clicks, Impressions a případně Purchase conversion value.',
email:'Ecomail / jiný e-mailing → export agregovaných statistik kampaní: Sent, Opens, Clicks, Unsubscribes.',
reservations:'Rezervační systém → souhrnný CSV export: Reservations / Rezervace, Guests / Počet hostů, Cancellations / Storna. Bez jmen, telefonů či e-mailových adres hostů.'
};
const connectionRequirements:Record<Channel,{access:string;automation:string;credential:string}> = {
ga4:{access:'Google Analytics 4 → role Čtenář / Viewer + ID GA4 property',automation:'Google Analytics Data API; bezpečná serverová autorizace přes OAuth / servisní účet',credential:'OAuth / servisní účet výhradně na serveru'},
google_ads:{access:'Přístup do reklamního účtu (ideálně read-only), Customer ID a případně MCC',automation:'Google Ads API včetně developer tokenu a Google OAuth, alternativně lokální Fachman',credential:'Google OAuth token + developer token (serverové tajemství)'},
meta_ads:{access:'Meta Business portfolio, reklamní účet a oprávnění číst Insights',automation:'Meta Marketing API, autorizace Business app a systémový uživatel / OAuth',credential:'Meta access token (serverové tajemství)'},
email:{access:'Ecomail účet s oprávněním pro statistiky kampaní; jiný poskytovatel dle API',automation:'Ecomail API nebo zabezpečené stahování agregovaných exportů',credential:'API klíč Ecomail (serverové tajemství)'},
reservations:{access:'Název rezervačního systému + přístup ke statistikám a souhrnnému exportu',automation:'API / webhook, případně naplánovaný anonymizovaný CSV export podle dodavatele',credential:'API klíč / webhook secret pouze na serveru'}
};
type SnapshotState=Record<string,Partial<Record<Channel,ChannelReport>>>;
export function StrategyPage(){
  const {client}=useWorkspace();
  const name=clients[client] ?? '';
  const [all,setAll]=useState<SnapshotState>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [objective,setObjective]=useState<'bookings'|'leads'|'sales'>('bookings');
  const reports=all[name] ?? {};
  const suggestions=recommendStrategy(reports,objective);
  const importFile=(channel:Channel,file:File|undefined)=>{
    if(!file)return;
    if(!/\.(csv|txt)$/i.test(file.name)){setErrors(s=>({...s,[channel]:'Použijte CSV soubor.'}));return;}
    void file.text().then(csv=>{
      const report=parseChannelReport(channel,csv,file.name);
      setAll(s=>({...s,[name]:{...s[name],[channel]:report}}));
      setErrors(s=>({...s,[channel]:''}));
    }).catch((error:unknown)=>setErrors(s=>({...s,[channel]:error instanceof Error?error.message:'Import se nezdařil'})));
  };
  const exportStrategy=()=>{
    const lines=[`AVQIX — Marketingová strategie: ${name}`,`Obchodní cíl: ${objective}`,`Datum: ${new Date().toLocaleDateString('cs-CZ')}`,'','DATOVÉ ZDROJE',
    ...channels.map(c=>`${channelNames[c]}: ${reports[c] ? reports[c]!.fileName + ' (' + reports[c]!.updatedAt + ')' : 'nenačteno'}`),'',
    'DOPORUČENÍ',...suggestions.flatMap((s,i)=>[`${i+1}. [${s.priority}] ${s.title}`,s.explanation,`Akce: ${s.action}`,'']),
    'Poznámka: data jsou agregovaná z jednotlivých exportů. Různá období a atribuční modely nemusí být přímo srovnatelné.'];
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='avqix-strategie.txt';link.click();
    URL.revokeObjectURL(url);
  };
  return <main className="page-content">
    <PageHeader title="Strategie & integrace" description="Jeden přehled GA4, Google Ads, Meta Ads, e-mailingu a rezervací. Doporučení vycházejí z nahraných dat, ne z demo čísel." />
    {!isCustomClient(client) && <div className="info-banner">Vybraný pracovní prostor je ukázkový. Pro skutečná klientská data vytvořte vlastního klienta v sekci Klienti.</div>}
    <div className="info-banner">Přímé API konektory zatím nejsou zapnuté. Toto je funkční import agregovaných CSV a pravidlová strategie. Nahrané soubory se zpracují v prohlížeči, tato stránka je nesynchronizuje do cloudu. Po obnovení stránky je nutné nahrát je znovu.</div>
    <section className="reco-section">
      <SectionHeading title="Obchodní cíl klienta" subtitle="Určuje priority marketingových doporučení" />
      <label htmlFor="strategy-objective">Optimalizovat na </label>
      <select id="strategy-objective" value={objective} onChange={e=>setObjective(e.target.value as typeof objective)} className="rounded-md border bg-background p-2 ml-2">
        <option value="bookings">Rezervace</option><option value="leads">Poptávky / leady</option><option value="sales">Tržby / prodeje</option>
      </select>
    </section>
    <section className="reco-section">
      <SectionHeading title="Připravenost pro prvního klienta" subtitle="Co přichystat k bezpečnému živému napojení. Stav importu neznamená aktivní API." />
      <p className="gsc-note">Autorizace a přístupové tokeny nikdy nevkládejte do tohoto formuláře, veřejného repozitáře ani do CSV. API konektory musí běžet na serveru, s oddělením dat klientů, obnovou tokenů a logem synchronizace.</p>
      <div className="reco-grid">{channels.map(channel=><article className="reco-card" key={channel}>
        <h3>{channelNames[channel]}</h3>
        <p><strong>Co získat:</strong> {connectionRequirements[channel].access}</p>
        <p><strong>Živá synchronizace:</strong> {connectionRequirements[channel].automation}</p>
        <p><strong>Přístupové údaje:</strong> {connectionRequirements[channel].credential}</p>
        <p><strong>Import CSV:</strong> {reports[channel] ? 'Otestován importem tohoto souboru' : 'Připraven k vyzkoušení'}</p>
        <p><strong>API:</strong> Nepřipojeno – vyžaduje autorizaci a skutečný integrační test</p>
      </article>)}</div>
    </section>
    <SectionHeading title="Datové zdroje" subtitle={`${channels.filter(c=>!!reports[c]).length} z 5 importováno · klient: ${name}`} />
    <div className="connector-grid">
    {channels.map(channel=><article key={channel} className="connector-card">
      <div className="connector-head"><div><strong>{channelNames[channel]}</strong><p>{reports[channel]?'Načteno '+reports[channel]!.rowCount+' řádků':'Čeká na první import'}</p></div></div>
      <p className="connector-note">{instructions[channel]}</p>
      <label className="inline-flex flex-col gap-2 text-sm">Nahrát CSV
        <input aria-label={`CSV ${channelNames[channel]}`} type="file" accept=".csv,.txt,text/csv" onChange={e=>{importFile(channel,e.target.files?.[0]);e.target.value='';}} />
      </label>
      {errors[channel] && <p role="alert" className="text-destructive">{errors[channel]}</p>}
      {reports[channel] && <><p className="gsc-note">Soubor: {reports[channel]!.fileName}</p>
        <div className="flex flex-wrap gap-3 text-sm">{Object.entries(reports[channel]!.metrics).map(([key,value])=><span key={key}>{key}: <strong>{Number(value).toLocaleString('cs-CZ')}</strong></span>)}</div>
      </>}
    </article>)}
    </div>
    <section className="reco-section">
      <SectionHeading title="Strategická doporučení" subtitle="Základ pro týdenní marketingový plán a vyhodnocení klienta" />
      <div className="reco-grid">{suggestions.map((s,i)=><article className="reco-card" key={s.title+i}>
        <p className="text-sm">{s.priority} priorita</p><h3>{s.title}</h3><p>{s.explanation}</p><p><strong>Další krok:</strong> {s.action}</p>
      </article>)}</div>
      <div className="mt-5"><Button onClick={exportStrategy}>Exportovat strategii</Button></div>
    </section>
    <p className="gsc-note">Pozor: exporty musí pokrývat stejné období a měnu. GA4 tržby a tržby z reklamních platforem se nesčítají. Souhrnná data nedokážou sama o sobě prokázat atribuční vliv kampaní. Žádné změny v reklamních účtech se neprovádějí.</p>
  </main>;
}
