// Geri sayım: ASKF tarih/saat alanları (parse-askf.ts) 'YYYY-MM-DD' ve 'HH:MM' biçimindedir ve
// Europe/Istanbul duvar saatidir. Sabit +03 varsayılmaz; dilim farkı Intl ile hesaplanır.
export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export type Kickoff = string | { date: string; time: string };

const TZ = 'Europe/Istanbul';
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function istanbulOffsetMs(instant: number): number {
  const parts: Record<string, number> = {};
  for (const p of formatter.formatToParts(new Date(instant))) if (p.type !== 'literal') parts[p.type] = Number(p.value);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** 'YYYY-MM-DD' + 'HH:MM' (İstanbul duvar saati) -> UTC epoch ms. Geçersizse null. */
export function istanbulWallTimeToEpoch(date: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, da, h, mi, s] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2]), Number(t[3] ?? 0)];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59 || s > 59) return null;
  const naive = Date.UTC(y, mo - 1, da, h, mi, s);
  if (new Date(naive).getUTCMonth() !== mo - 1) return null;
  // İki geçişli çözüm: ofset hedef ana yakın örneklenir.
  const first = naive - istanbulOffsetMs(naive);
  return naive - istanbulOffsetMs(first);
}

export function kickoffToEpoch(kickoff: Kickoff): number | null {
  if (typeof kickoff === 'string') {
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(kickoff);
    if (hasZone) {
      const parsed = Date.parse(kickoff);
      return Number.isNaN(parsed) ? null : parsed;
    }
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)/.exec(kickoff);
    return m ? istanbulWallTimeToEpoch(m[1], m[2]) : null;
  }
  return istanbulWallTimeToEpoch(kickoff.date, kickoff.time);
}

/** Maça kalan süre; maç başladıysa/geçmişse veya girdi geçersizse null. */
export function countdownTo(kickoff: Kickoff, now: Date): Countdown | null {
  const target = kickoffToEpoch(kickoff);
  if (target === null) return null;
  const diff = Math.floor((target - now.getTime()) / 1000);
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
  };
}
