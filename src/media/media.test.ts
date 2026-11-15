import { describe, expect, it } from 'vitest';
import { countdownTo, istanbulWallTimeToEpoch } from './countdown';
import { allSponsorsApproved, DEFAULT_SPONSORS, getSponsors } from './sponsors';

// İstanbul 2026'da UTC+3 (kalıcı); 12:00 İstanbul = 09:00 UTC.
const KICK = { date: '2026-11-20', time: '12:00' };

describe('geri sayım', () => {
  it('İstanbul duvar saatini doğru UTC anına çevirir', () => {
    expect(istanbulWallTimeToEpoch('2026-11-20', '12:00')).toBe(Date.UTC(2026, 10, 20, 9, 0, 0));
    expect(istanbulWallTimeToEpoch('2026-11-20', '00:30')).toBe(Date.UTC(2026, 10, 19, 21, 30, 0));
    expect(istanbulWallTimeToEpoch('2026-02-30', '10:00')).toBeNull();
    expect(istanbulWallTimeToEpoch('2026-11-20', '25:00')).toBeNull();
  });
  it('kalan süreyi gün/saat/dakika/saniye verir', () => {
    expect(countdownTo(KICK, new Date('2026-11-18T06:58:55Z'))).toEqual({ days: 2, hours: 2, minutes: 1, seconds: 5 });
  });
  it('geçmiş maç ve tam sınır null', () => {
    expect(countdownTo(KICK, new Date('2026-11-20T09:00:00Z'))).toBeNull();
    expect(countdownTo(KICK, new Date('2026-11-20T09:00:01Z'))).toBeNull();
    expect(countdownTo(KICK, new Date('2026-11-20T08:59:59Z'))).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
  });
  it('gün dönümü: İstanbul 00:30 maçı UTC bir önceki güne düşer', () => {
    const c = countdownTo({ date: '2026-11-20', time: '00:30' }, new Date('2026-11-19T21:00:00Z'));
    expect(c).toEqual({ days: 0, hours: 0, minutes: 30, seconds: 0 });
  });
  it('ISO dizeleri: dilimsiz = İstanbul, dilimli = olduğu gibi; geçersiz null', () => {
    const now = new Date('2026-11-20T08:00:00Z');
    expect(countdownTo('2026-11-20T12:00:00', now)).toEqual({ days: 0, hours: 1, minutes: 0, seconds: 0 });
    expect(countdownTo('2026-11-20T12:00:00Z', now)).toEqual({ days: 0, hours: 4, minutes: 0, seconds: 0 });
    expect(countdownTo('bozuk', now)).toBeNull();
  });
  it('yaz saati olan geçmiş yıl da İstanbul kuralıyla çözülür (sabit +03 değil)', () => {
    // 2015 yazı Türkiye UTC+3 (EEST), kışı UTC+2.
    expect(istanbulWallTimeToEpoch('2015-01-15', '12:00')).toBe(Date.UTC(2015, 0, 15, 10, 0, 0));
    expect(istanbulWallTimeToEpoch('2015-07-15', '12:00')).toBe(Date.UTC(2015, 6, 15, 9, 0, 0));
  });
});

describe('sponsorlar', () => {
  it('prototip adları, hiçbiri sahibince onaylı değil', () => {
    expect(DEFAULT_SPONSORS.map((s) => s.name)).toContain('DARICA BELEDİYESİ');
    expect(DEFAULT_SPONSORS).toHaveLength(6);
    expect(DEFAULT_SPONSORS.every((s) => s.approvedByOwner === false)).toBe(true);
    expect(allSponsorsApproved()).toBe(false);
  });
  it('getSponsors kopya döner', () => {
    const list = getSponsors();
    list[0].approvedByOwner = true;
    expect(DEFAULT_SPONSORS[0].approvedByOwner).toBe(false);
  });
});
