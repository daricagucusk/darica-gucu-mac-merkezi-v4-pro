import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildForecastUrl, clearWeatherCache, getWeatherCached, getWeatherForMatch, isForecastable, parseMatchTime,
  pickHour, weatherLabel, WEATHER_SOURCE, type FetchLike,
} from './weather';

const NOW = new Date('2026-11-15T10:00:00Z');
const payload = {
  hourly: {
    time: ['2026-11-20T11:00', '2026-11-20T12:00', '2026-11-20T13:00'],
    temperature_2m: [11.2, 12.6, 13.1],
    weathercode: [3, 61, 0],
  },
};
const okFetch = (calls: string[] = []): FetchLike => async (url) => {
  calls.push(url);
  return { ok: true, json: async () => payload };
};

beforeEach(() => clearWeatherCache());

describe('hava saf fonksiyonları', () => {
  it('URL Darıca koordinatlarını ve İstanbul dilimini içerir, anahtar içermez', () => {
    const url = buildForecastUrl();
    expect(url).toContain('latitude=40.77');
    expect(url).toContain('longitude=29.37');
    expect(url).toContain('timezone=Europe%2FIstanbul');
    expect(url).not.toMatch(/key|token/i);
  });
  it('kod -> Türkçe etiket', () => {
    expect(weatherLabel(0)).toBe('Açık');
    expect(weatherLabel(61)).toBe('Yağmurlu');
    expect(weatherLabel(95)).toBe('Gök gürültülü fırtına');
    expect(weatherLabel(1234)).toBe('Bilinmiyor');
  });
  it('maç zamanı ayrıştırma: dilimsiz = İstanbul', () => {
    expect(parseMatchTime('2026-11-20T12:00:00')).toBe(Date.UTC(2026, 10, 20, 9));
    expect(parseMatchTime('2026-11-20T12:00:00Z')).toBe(Date.UTC(2026, 10, 20, 12));
    expect(parseMatchTime('saçma')).toBeNull();
  });
  it('en yakın saati seçer; 30 dk dışındaysa null', () => {
    const noon = Date.UTC(2026, 10, 20, 9);
    expect(pickHour(payload, noon + 10 * 60000)).toEqual({ at: '2026-11-20T12:00', temperatureC: 13, weatherCode: 61 });
    expect(pickHour(payload, Date.UTC(2026, 10, 25, 9))).toBeNull();
    expect(pickHour({ hourly: {} }, noon)).toBeNull();
    expect(pickHour(null, noon)).toBeNull();
  });
  it('16 gün sınırı ve geçmiş', () => {
    const day = 24 * 3600 * 1000;
    expect(isForecastable(NOW.getTime() + 15 * day, NOW)).toBe(true);
    expect(isForecastable(NOW.getTime() + 17 * day, NOW)).toBe(false);
    expect(isForecastable(NOW.getTime() - 5 * 3600 * 1000, NOW)).toBe(false);
  });
});

describe('hava servisi (ağ enjekte)', () => {
  it('başarılı yanıt: sıcaklık, etiket, kaynak atfı', async () => {
    const r = await getWeatherForMatch('2026-11-20T12:00:00', NOW, okFetch());
    expect(r).toEqual({ available: true, source: WEATHER_SOURCE, at: '2026-11-20T12:00', temperatureC: 13, weatherCode: 61, label: 'Yağmurlu' });
    expect(WEATHER_SOURCE).toBe('Open-Meteo (CC BY 4.0)');
  });
  it('16 günden uzak maç için ağa hiç çıkmaz', async () => {
    const calls: string[] = [];
    const r = await getWeatherForMatch('2026-12-20T12:00:00', NOW, okFetch(calls));
    expect(r.available).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it('HTTP hatası, fırlatma ve bozuk veri: available=false (sabit değer yok)', async () => {
    expect((await getWeatherForMatch('2026-11-20T12:00:00', NOW, async () => ({ ok: false, json: async () => ({}) }))).available).toBe(false);
    expect((await getWeatherForMatch('2026-11-20T12:00:00', NOW, async () => { throw new Error('ağ'); })).available).toBe(false);
    expect((await getWeatherForMatch('2026-11-20T12:00:00', NOW, async () => ({ ok: true, json: async () => ({ hourly: { time: [] } }) }))).available).toBe(false);
  });
  it('3 sn zaman aşımında iptal eder', async () => {
    const hang: FetchLike = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('abort')));
    });
    const r = await getWeatherForMatch('2026-11-20T12:00:00', NOW, hang, 20);
    expect(r.available).toBe(false);
  });
  it('bellek önbelleği: ikinci çağrı ağa çıkmaz, süre dolunca yeniler', async () => {
    const calls: string[] = [];
    await getWeatherCached('2026-11-20T12:00:00', NOW, okFetch(calls));
    await getWeatherCached('2026-11-20T11:00:00', new Date(NOW.getTime() + 60000), okFetch(calls));
    expect(calls).toHaveLength(1);
    await getWeatherCached('2026-11-20T12:00:00', new Date(NOW.getTime() + 31 * 60000), okFetch(calls));
    expect(calls).toHaveLength(2);
  });
  it('başarısız yanıt önbelleğe girmez', async () => {
    await getWeatherCached('2026-11-20T12:00:00', NOW, async () => ({ ok: false, json: async () => ({}) }));
    const calls: string[] = [];
    const r = await getWeatherCached('2026-11-20T12:00:00', NOW, okFetch(calls));
    expect(r.available).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
