import { describe, expect, it } from 'vitest';
import { filterByTab, groupLabel, mapsUrl, matchShareText, titleTr, weekRange, type FxMatch } from './fixture-utils';

const m = (id: string, date: string, time: string): FxMatch => ({
  id, group: 'U12', date, time, home: 'DARICA GÜCÜ SPOR', away: 'KOCAELİ 1937 SEKA SPOR', venue: 'DARICA NENEHATUN STADI 1', status: 'scheduled',
});

// 2026-11-09 Pazartesi 10:00 İstanbul = 07:00Z
const NOW = new Date('2026-11-09T07:00:00Z');

describe('filterByTab', () => {
  const matches = [
    m('prev-sun', '2026-11-08', '19:00'),
    m('past-today', '2026-11-09', '09:59'),
    m('today', '2026-11-09', '18:00'),
    m('sun', '2026-11-15', '23:59'),
    m('next-mon', '2026-11-16', '00:00'),
  ];

  it('yaklaşan: şimdiden sonrakiler, artan sırada', () => {
    expect(filterByTab(matches, 'upcoming', NOW).map((x) => x.id)).toEqual(['today', 'sun', 'next-mon']);
  });
  it('sonuçlar: şimdiden önceki, en yeni önce', () => {
    expect(filterByTab(matches, 'past', NOW).map((x) => x.id)).toEqual(['past-today', 'prev-sun']);
  });
  it('bu hafta: İstanbul Pzt-Paz, pazar 23:59 dahil, sonraki pazartesi 00:00 hariç', () => {
    expect(filterByTab(matches, 'week', NOW).map((x) => x.id)).toEqual(['past-today', 'today', 'sun']);
  });
  it('gece yarısı: UTC pazar 21:30 İstanbul pazartesi 00:30 sayılır', () => {
    const lateSunUtc = new Date('2026-11-15T21:30:00Z'); // İstanbul 16 Kasım Pazartesi 00:30
    expect(weekRange(lateSunUtc)).toEqual(['2026-11-16', '2026-11-22']);
    expect(weekRange(new Date('2026-11-15T20:30:00Z'))).toEqual(['2026-11-09', '2026-11-15']);
  });
  it('geçersiz saatli maçı atlar', () => {
    expect(filterByTab([m('x', '2026-11-10', '99:99')], 'upcoming', NOW)).toEqual([]);
  });
});

describe('yardımcılar', () => {
  it('groupLabel U12 -> U-12', () => {
    expect(groupLabel('U12')).toBe('U-12');
    expect(groupLabel('U14')).toBe('U-14');
    expect(groupLabel(undefined)).toBe('');
  });
  it('titleTr Türkçe büyük/küçük harf', () => {
    expect(titleTr('DARICA GÜCÜ SPOR')).toBe('Darıca Gücü Spor');
    expect(titleTr('KOCAELİ 1937 SEKA SPOR')).toBe('Kocaeli 1937 Seka Spor');
  });
  it('mapsUrl saha adını kodlar', () => {
    const url = mapsUrl('DARICA NENEHATUN STADI 1');
    expect(url.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Darıca Nenehatun Stadı 1, Kocaeli');
  });
  it('paylaşım metni gerçek alanları içerir', () => {
    const text = matchShareText(m('a', '2026-11-09', '18:00'));
    expect(text).toContain('U-12: Darıca Gücü Spor - Kocaeli 1937 Seka Spor');
    expect(text).toContain('Tarih: 09 Kasım 2026 Pazartesi');
    expect(text).toContain('Saat: 18:00');
    expect(text).toContain('Saha: Darıca Nenehatun Stadı 1');
  });
});
