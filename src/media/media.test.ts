import { describe, expect, it } from 'vitest';
import { countdownTo, istanbulWallTimeToEpoch } from './countdown';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allSponsorsApproved, DEFAULT_SPONSORS, getSponsors, instagramUrl, sponsorSubline, sponsorThanksLine } from './sponsors';

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

describe('sponsorlar (kulüp yöneticisinin gerçek listesi)', () => {
  it('yalnız gerçek üç sponsor; prototip adları yok; hepsi onaylı', () => {
    expect(DEFAULT_SPONSORS.map((s) => s.id)).toEqual(['arapcesme', 'kanatci-nizam', 'doganay-raf']);
    const names = DEFAULT_SPONSORS.map((s) => s.name).join('|');
    for (const eski of ['BELEDİYESİ', 'MARMARA', 'ÇINARALTI', 'AKADEMİ', 'KOCAELİ B.B.', 'KOCAELİ ASKF']) expect(names.toUpperCase()).not.toContain(eski);
    expect(DEFAULT_SPONSORS.every((s) => s.approvedByOwner === true)).toBe(true);
    expect(allSponsorsApproved()).toBe(true);
  });
  it('Instagram hesapları ve bağlantıları doğru; Doğanay Raf için hesap/logo uydurulmaz', () => {
    const by = Object.fromEntries(DEFAULT_SPONSORS.map((s) => [s.id, s]));
    expect(instagramUrl(by.arapcesme)).toBe('https://www.instagram.com/arapcesmedis/');
    expect(instagramUrl(by['kanatci-nizam'])).toBe('https://www.instagram.com/kanatcinizam/');
    expect(by['doganay-raf'].instagram).toBeUndefined();
    expect(by['doganay-raf'].logo).toBeUndefined();
    expect(by['doganay-raf'].role).toBe('Forma Sponsoru');
    expect(instagramUrl(by['doganay-raf'])).toBeNull();
    expect(instagramUrl({ instagram: '@kötü hesap/..' })).toBeNull();
  });
  it('her logo yolu public/ altında gerçekten var', () => {
    for (const s of DEFAULT_SPONSORS.filter((x) => x.logo)) {
      expect(existsSync(fileURLToPath(new URL(`../../public${s.logo}`, import.meta.url))), s.logo).toBe(true);
    }
  });
  it('getSponsors kopya döner', () => {
    const list = getSponsors();
    list[0].name = 'DEĞİŞTİ';
    expect(DEFAULT_SPONSORS[0].name).not.toBe('DEĞİŞTİ');
  });
  it('bülten teşekkür satırı: hesabı olanın handle ı, olmayanın yalnız adı', () => {
    const line = sponsorThanksLine();
    expect(line).toContain('Doğanay Raf');
    expect(line).toContain('@arapcesmedis');
    expect(line).toContain('@kanatcinizam');
    expect(line.match(/@/g)).toHaveLength(2);
    expect(sponsorThanksLine([])).toBe('');
  });
  it('alt satır: rol varsa rol, yoksa Instagram', () => {
    const by = Object.fromEntries(DEFAULT_SPONSORS.map((s) => [s.id, s]));
    expect(sponsorSubline(by['doganay-raf'])).toBe('Forma Sponsoru');
    expect(sponsorSubline(by.arapcesme)).toBe('@arapcesmedis');
  });
});
