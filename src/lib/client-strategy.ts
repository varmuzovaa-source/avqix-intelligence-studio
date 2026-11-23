import { normalizeHeader, parseCsv, parseNumber } from './csv-import';

export type Channel = 'ga4' | 'google_ads' | 'meta_ads' | 'email' | 'reservations';
export type Metric = 'sessions' | 'conversions' | 'spend' | 'revenue' | 'clicks' | 'impressions' | 'sent' | 'opens' | 'unsubscribes' | 'reservations' | 'guests' | 'cancellations';
export type ChannelReport = { channel: Channel; fileName: string; updatedAt: string; rowCount: number; metrics: Partial<Record<Metric,number>> };
export type Advice = { priority: 'Vysoká' | 'Střední' | 'Nízká'; title: string; explanation: string; action: string };
export const channelNames: Record<Channel,string> = { ga4:'GA4',google_ads:'Google Ads',meta_ads:'Meta Ads',email:'E-mailing / Ecomail',reservations:'Rezervace' };
const aliases: Record<Channel, Partial<Record<Metric,string[]>>> = {
ga4:{sessions:['sessions','relace'],conversions:['key events','keyevents','conversions','konverze'],revenue:['total revenue','revenue','trzby']},
google_ads:{spend:['cost','cost czk','naklady','cena'],clicks:['clicks','kliknuti'],impressions:['impressions','zobrazeni'],conversions:['conversions','konverze'],revenue:['conv value','conversion value','hodnota konverzi']},
meta_ads:{spend:['amount spent','amount spent czk','vynalozena castka','spend','naklady'],clicks:['link clicks','clicks','kliknuti'],impressions:['impressions','zobrazeni'],conversions:['results','vysledky','purchases'],revenue:['purchase conversion value','revenue','hodnota nakupu']},
email:{sent:['sent','delivered','odeslano','doruceno'],opens:['opens','unique opens','otevreni'],clicks:['clicks','unique clicks','kliknuti'],unsubscribes:['unsubscribes','odhlaseni'],revenue:['revenue','trzby']},
reservations:{reservations:['reservations','bookings','rezervace','pocet rezervaci'],guests:['guests','covers','hoste','pocet hostu','pocet osob'],cancellations:['cancellations','cancelled','canceled','storna','zrusene rezervace'],revenue:['revenue','trzby','hodnota rezervaci']}
};
const required: Record<Channel,Metric> = {ga4:'sessions',google_ads:'spend',meta_ads:'spend',email:'sent',reservations:'reservations'};
export function parseChannelReport(channel:Channel,csv:string,fileName:string,updatedAt:string = new Date().toISOString()): ChannelReport {
  if(csv.length > 4_000_000) throw new Error('CSV přesahuje limit 4 MB');
  const rows=parseCsv(csv);
  if(rows.length < 2) throw new Error('Soubor musí obsahovat hlavičku a alespoň jeden datový řádek');
  const headers=rows[0]!.map(normalizeHeader);
  const columns=Object.entries(aliases[channel]) as [Metric,string[]][];
  const indices=columns.map(([metric,names])=>[metric,headers.findIndex(h=>names.includes(h))] as const).filter(([,index])=>index>=0);
  if(!indices.some(([metric])=>metric===required[channel])) throw new Error('Chybí povinná metrika: '+required[channel]);
  const metrics:Partial<Record<Metric,number>>={};
  let count=0;
  for(const row of rows.slice(1)){
    let found=false;
    for(const [metric,index] of indices){
      const raw=row[index]?.replace(/\b(CZK|Kč|EUR|USD)\b/gi,'').trim();
      const n=parseNumber(raw);
      if(Number.isFinite(n) && n>=0) { metrics[metric]=(metrics[metric]??0)+n; found=true; }
    }
    if(found) count++;
  }
  if(!count) throw new Error('Soubor neobsahuje čitelné číselné metriky');
  return {channel,fileName:fileName.slice(0,150),updatedAt,rowCount:count,metrics};
}
export function recommendStrategy(reports:Partial<Record<Channel,ChannelReport>>,objective:'bookings'|'leads'|'sales'='bookings'):Advice[]{
  const advice:Advice[]=[];
  const add=(priority:Advice['priority'],title:string,explanation:string,action:string)=>advice.push({priority,title,explanation,action});
  const adSpend=(reports.google_ads?.metrics.spend??0)+(reports.meta_ads?.metrics.spend??0);
  if(!Object.keys(reports).length) add('Vysoká','Načíst data','Bez skutečných čísel nelze navrhnout měřitelnou strategii.','Importujte report GA4 a alespoň jednoho placeného kanálu.');
  if(adSpend>0 && !reports.ga4) add('Vysoká','Ověřit dopad reklamy','Reklamní náklady existují, ale chybí data o návštěvnosti.','Doplňte GA4 za stejné období a ověřte UTM.');
  if(reports.ga4 && reports.ga4.metrics.conversions===undefined) add('Vysoká','Zkontrolovat měření konverzí','GA4 export nemá klíčové události.','Zaveďte nebo ověřte měření formulářů a dokončených rezervací.');
  if(objective==='bookings' && !reports.reservations) add('Vysoká','Doplnit skutečné rezervace','Počet rezervací a storna nelze vyhodnotit.','Importujte agregovaný export rezervací za stejné období.');
  const booked=reports.reservations?.metrics.reservations??0;
  const cancelled=reports.reservations?.metrics.cancellations;
  if(booked>0 && cancelled!==undefined && cancelled/booked>=.15) add('Vysoká','Omezit storna',`Storno poměr je ${(100*cancelled/booked).toFixed(1)} %.`,'Otestujte připomínky rezervací, potvrzovací zprávy a podmínky rušení.');
  if(adSpend>0 && booked>0 && objective==='bookings') add('Střední','Sledovat orientační náklad na rezervaci',`Reklamní výdaje / všechny rezervace = ${(adSpend/booked).toFixed(1)}. Nejde o atribučně očištěné CPA.`,'Zaveďte UTM a deduplikaci měření; srovnávejte stejná období.');
  for(const channel of ['google_ads','meta_ads'] as const){
    const m=reports[channel]?.metrics;
    if(m?.spend && m.conversions===undefined) add('Střední',`Doplnit konverze v ${channelNames[channel]}`,'Náklady jsou známé, konverze chybí.','Zkontrolujte export a měřicí události před změnou rozpočtu.');
    if(m?.spend && m.conversions===0) add('Vysoká',`Prověřit ${channelNames[channel]} bez konverzí`,'Kampaně mají náklady a nulové vykázané konverze.','Ověřte tracking a sestavy; rozpočty automaticky neměňte.');
  }
  const email=reports.email?.metrics;
  if(email?.sent && email.clicks!==undefined && email.clicks/email.sent<.01) add('Střední','Zvýšit prokliky z e-mailů',`CTR je ${(100*email.clicks/email.sent).toFixed(2)} %.`,'Testujte segmentaci, hlavní CTA a obsah po jednotlivých kampaních.');
  if(objective==='bookings' && booked>0 && !reports.email) add('Nízká','Nastavit retenční e-mailing','Rezervace existují, ale nejsou data o návratu hostů.','S potřebným souhlasem připravte follow-up a nabídku opakované návštěvy.');
  if(!advice.length) add('Nízká','Týdenní kontrola výkonu','Na dostupných agregovaných datech není jednoznačný varovný signál.','Doplňte cíle KPI a porovnávejte stejná období.');
  return advice.sort((a,b)=>({Vysoká:0,Střední:1,Nízká:2}[a.priority]-{Vysoká:0,Střední:1,Nízká:2}[b.priority]));
}
