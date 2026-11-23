import { describe, expect, it } from 'vitest';
import { parseChannelReport, recommendStrategy } from './client-strategy';

describe('multichannel reports', () => {
  it('parses Czech GA4 data and sums sessions and conversions', () => {
    const report=parseChannelReport('ga4','Relace;Konverze;Tržby\n100;5;1200,50\n50;2;800,50','ga4.csv','2026-11-23');
    expect(report.metrics.sessions).toBe(150);
    expect(report.metrics.conversions).toBe(7);
    expect(report.metrics.revenue).toBe(2001);
  });
  it('parses Ecomail-compatible exports', () => {
    expect(parseChannelReport('email','sent,opens,clicks,unsubscribes\n1000,200,7,2','email.csv').metrics.clicks).toBe(7);
  });
  it('parses reservation totals and cancellations', () => {
    const report=parseChannelReport('reservations','Rezervace;Počet hostů;Storna\n40;75;8','rezervace.csv');
    expect(report.metrics.reservations).toBe(40);
    expect(report.metrics.cancellations).toBe(8);
  });
  it('rejects reports with missing required metric', () => {
    expect(()=>parseChannelReport('google_ads','Clicks\n5','bad.csv')).toThrow('spend');
  });
  it('rejects empty reports', () => {
    expect(()=>parseChannelReport('ga4','Relace\n','empty.csv')).toThrow();
  });
  it('does not mix ad platform revenues with GA4 revenue', () => {
    const ga4=parseChannelReport('ga4','sessions,revenue\n100,500','ga.csv');
    const ads=parseChannelReport('google_ads','cost,conversion value\n100,600','ads.csv');
    expect(ga4.metrics.revenue).toBe(500);
    expect(ads.metrics.revenue).toBe(600);
  });
});
describe('strategic recommendations', () => {
  it('flags missing GA4 and reservations when spend exists', () => {
    const ad=parseChannelReport('google_ads','cost,conversions\n500,3','ad.csv');
    const ideas=recommendStrategy({google_ads:ad},'bookings');
    expect(ideas.some(x=>x.title.includes('dopad reklamy'))).toBe(true);
    expect(ideas.some(x=>x.title.includes('rezervace'))).toBe(true);
  });
  it('flags high cancellation rates and poor email clicks', () => {
    const reservations=parseChannelReport('reservations','rezervace,storna\n100,20','booking.csv');
    const email=parseChannelReport('email','sent,clicks\n1000,4','email.csv');
    const ideas=recommendStrategy({reservations,email},'bookings');
    expect(ideas.some(x=>x.title.includes('storna'))).toBe(true);
    expect(ideas.some(x=>x.title.includes('prokliky'))).toBe(true);
  });
  it('does not claim attributed CPA', () => {
    const reservations=parseChannelReport('reservations','rezervace\n25','booking.csv');
    const ads=parseChannelReport('meta_ads','spend\n1000','meta.csv');
    const advice=recommendStrategy({reservations,meta_ads:ads},'bookings');
    expect(advice.find(x=>x.title.includes('náklad na rezervaci'))?.explanation).toContain('Nejde o atribučně očištěné CPA');
  });
});