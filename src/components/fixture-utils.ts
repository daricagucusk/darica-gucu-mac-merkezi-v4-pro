import { normalizeClubKey } from '../domain/tracking';
import { kickoffToEpoch } from '../media/countdown';
import { buildIcs, downloadIcs, googleCalendarUrl, type CalendarEvent } from './calendar-utils';

export type FxMatch = {
  id: string; group: string; date: string; time: string; home: string; away: string; venue: string;
  field?: string; status: 'scheduled' | 'postponed' | 'cancelled';
};
export type FxChange = {
  fixtureId: string; type: string; status?: string; previous?: Partial<FxMatch>; current?: Partial<FxMatch>;
};
export type DiffRow = { key: string; icon: 'clock' | 'pin' | 'calendar' | 'shield'; label: string; from: string; to: string };

export const isDarica = (name: string | undefined): boolean => !!name && normalizeClubKey(name) === 'DARICAGUCUSPOR';
export const side = (m: Pick<FxMatch, 'home' | 'away'>): 'home' | 'away' | null =>
  isDarica(m.home) ? 'home' : isDarica(m.away) ? 'away' : null;

/** 'U12' -> 'U-12'; diğer değerler olduğu gibi. */
export const groupLabel = (group: string | undefined): string => (group ?? '').replace(/^U(\d+)$/i, 'U-$1');

/** ASKF büyük harf adlarını okunur hale getirir (KOCAELİ OKAN SPOR -> Kocaeli Okan Spor). */
export function titleTr(name: string): string {
  return name.toLocaleLowerCase('tr-TR').split(' ').map((w) => (w ? w[0].toLocaleUpperCase('tr-TR') + w.slice(1) : w)).join(' ');
}

const TZ = 'Europe/Istanbul';
const at = (date: string) => new Date(`${date}T12:00:00+03:00`);
export const longDate = (date: string): string =>
  new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long', timeZone: TZ }).format(at(date));
export function shortDate(date: string): string {
  const p = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', weekday: 'short', timeZone: TZ }).formatToParts(at(date));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('day')}.${g('month')} ${g('weekday')}`;
}

export const mapsUrl = (venue: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${titleTr(venue)}, Kocaeli`)}`;

export const istanbulToday = (now: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);

/** İstanbul takvimine göre bu haftanın [pazartesi, pazar] tarihleri. */
export function weekRange(now: Date): [string, string] {
  const d = new Date(`${istanbulToday(now)}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return [iso(d.getTime() - dow * 864e5), iso(d.getTime() + (6 - dow) * 864e5)];
}

export type TabId = 'upcoming' | 'week' | 'past';
export function filterByTab(matches: FxMatch[], tab: TabId, now: Date): FxMatch[] {
  const withTime = matches
    .map((match) => ({ match, t: kickoffToEpoch({ date: match.date, time: match.time }) }))
    .filter((item): item is { match: FxMatch; t: number } => item.t !== null);
  if (tab === 'past') return withTime.filter((i) => i.t < now.getTime()).sort((a, b) => b.t - a.t).map((i) => i.match);
  if (tab === 'week') {
    const [from, to] = weekRange(now);
    return withTime.filter((i) => i.match.date >= from && i.match.date <= to).sort((a, b) => a.t - b.t).map((i) => i.match);
  }
  return withTime.filter((i) => i.t >= now.getTime()).sort((a, b) => a.t - b.t).map((i) => i.match);
}

export const matchTitle = (m: Pick<FxMatch, 'home' | 'away'>): string => `${titleTr(m.home)} - ${titleTr(m.away)}`;

export function matchShareText(m: FxMatch): string {
  return [
    'DARICA GÜCÜ SPOR KULÜBÜ - MAÇ BÜLTENİ',
    `${groupLabel(m.group)}: ${matchTitle(m)}`,
    `Tarih: ${longDate(m.date)}`,
    `Saat: ${m.time}`,
    `Saha: ${titleTr(m.venue)}`,
  ].join('\n');
}

export function changeTouchesDarica(c: FxChange): boolean {
  const m = c.current ?? c.previous;
  return !!m && (isDarica(m.home) || isDarica(m.away));
}
export const CRITICAL_TYPES = ['kickoff_changed', 'venue_changed', 'teams_changed'];
export const isCritical = (c: FxChange): boolean => CRITICAL_TYPES.includes(c.type);
export const isVerificationOnly = (c: FxChange): boolean => c.type === 'missing' || c.status === 'verification_required';

/** Eski -> yeni gösterimi; yalnızca gerçekten değişen alanlar. */
export function diffRows(c: FxChange): DiffRow[] {
  const p = c.previous ?? {};
  const n = c.current ?? {};
  const rows: DiffRow[] = [];
  if (c.type === 'kickoff_changed' || c.type === 'teams_changed' || c.type === 'venue_changed') {
    if (p.date && n.date && p.date !== n.date) rows.push({ key: 'd', icon: 'calendar', label: 'Tarih:', from: shortDate(p.date), to: `${shortDate(n.date)} (Yeni Tarih)` });
    if (p.time && n.time && p.time !== n.time) rows.push({ key: 't', icon: 'clock', label: 'Başlama Saati:', from: p.time, to: `${n.time} (Yeni Saat)` });
    if (p.venue && n.venue && p.venue !== n.venue) rows.push({ key: 'v', icon: 'pin', label: 'Saha Tahsisi:', from: titleTr(p.venue), to: titleTr(n.venue) });
    if (c.type === 'teams_changed') {
      if (p.group && n.group && p.group !== n.group) rows.push({ key: 'g', icon: 'shield', label: 'Kategori:', from: groupLabel(p.group), to: groupLabel(n.group) });
      if ((p.home && n.home && p.home !== n.home) || (p.away && n.away && p.away !== n.away)) {
        rows.push({ key: 'k', icon: 'shield', label: 'Karşılaşma:', from: matchTitle({ home: p.home ?? '', away: p.away ?? '' }), to: matchTitle({ home: n.home ?? '', away: n.away ?? '' }) });
      }
    }
  }
  return rows;
}

export function changeHeadline(c: FxChange): string {
  const m = c.current ?? c.previous ?? {};
  const names = `${titleTr(m.home ?? 'Takım')} vs ${titleTr(m.away ?? 'Takım')}`;
  switch (c.type) {
    case 'added': return `${groupLabel(m.group)}: ${names} maçı programa eklendi`;
    case 'missing': return `${groupLabel(m.group)}: ${names} maçı yeni programda görünmüyor`;
    default: return `${groupLabel(m.group)}: ${names} Maçında Değişiklik!`;
  }
}

export function changeShareText(changes: FxChange[]): string {
  const lines = ['DARICA GÜCÜ SPOR KULÜBÜ - PROGRAM DEĞİŞİKLİĞİ'];
  for (const c of changes) {
    lines.push('', changeHeadline(c));
    if (isVerificationOnly(c)) { lines.push('İptal değil, doğrulama gerekli.'); continue; }
    const rows = diffRows(c);
    for (const r of rows) lines.push(`${r.label} ${r.from} -> ${r.to.replace(/ \((Yeni [^)]+)\)/, '')}`);
    const n = c.current;
    if (!rows.length && n?.date && n.time) lines.push(`${longDate(n.date)} ${n.time} - ${titleTr(n.venue ?? '')}`);
  }
  return lines.join('\n');
}

export function toCalendarEvent(m: FxMatch): CalendarEvent | null {
  const startEpoch = kickoffToEpoch({ date: m.date, time: m.time });
  if (startEpoch === null) return null;
  return {
    uid: m.id,
    summary: `${groupLabel(m.group)}: ${matchTitle(m)}`,
    startEpoch,
    location: titleTr(m.venue),
    description: 'Darıca Gücü Spor Kulübü - ASKF resmî fikstürü. Hatırlatıcı: maçtan 2 saat önce.',
  };
}
export const googleUrlFor = (m: FxMatch): string | null => { const e = toCalendarEvent(m); return e ? googleCalendarUrl(e) : null; };
export function downloadIcsFor(matches: FxMatch[], filename: string): boolean {
  const events = matches.map(toCalendarEvent).filter((e): e is CalendarEvent => e !== null);
  if (!events.length) return false;
  downloadIcs(filename, buildIcs(events));
  return true;
}

/** Paylaşım: önce sistem paylaşım menüsü, yoksa WhatsApp bağlantısı + panoya kopya. Dönüş: kullanıcıya gösterilecek mesaj. */
export async function shareText(text: string, title: string): Promise<string> {
  try {
    if (typeof navigator.share === 'function') { await navigator.share({ title, text }); return 'Paylaşım menüsü açıldı.'; }
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return '';
  }
  try { await navigator.clipboard?.writeText(text); } catch { /* pano izni yok */ }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  return 'WhatsApp açıldı; metin panoya da kopyalandı.';
}

export function minutesAgoLabel(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const min = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dakika önce`;
  if (min < 1440) return `${Math.floor(min / 60)} saat önce`;
  return `${Math.floor(min / 1440)} gün önce`;
}
