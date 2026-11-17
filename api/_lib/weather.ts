// Hava durumu alan mantığı (saf fonksiyonlar). Kaynak: Open-Meteo (anahtarsız, CC BY 4.0 — atıf gerekli).
import { istanbulWallTimeToEpoch } from '../../src/media/countdown.js';

export const WEATHER_SOURCE = 'Open-Meteo (CC BY 4.0)';
export const DARICA = { latitude: 40.77, longitude: 29.37 } as const;
export const MAX_FORECAST_DAYS = 16;
export const WEATHER_TIMEOUT_MS = 3000;
export const CACHE_TTL_MS = 30 * 60 * 1000;

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export type WeatherResult =
  | { available: false; source: string }
  | { available: true; source: string; at: string; temperatureC: number; weatherCode: number; label: string };

export function unavailable(): WeatherResult {
  return { available: false, source: WEATHER_SOURCE };
}

/** `at`: saat dilimli ISO (Z/+03:00) ya da dilimsiz (İstanbul duvar saati). Geçersizse null. */
export function parseMatchTime(at: string): number | null {
  if (typeof at !== 'string' || at.length > 40) return null;
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(at)) {
    const parsed = Date.parse(at);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})/.exec(at);
  return m ? istanbulWallTimeToEpoch(m[1], m[2]) : null;
}

/** Tahmin penceresinde mi (geçmiş değil, 16 günden uzak değil). */
export function isForecastable(matchEpoch: number, now: Date): boolean {
  const diff = matchEpoch - now.getTime();
  return diff >= -60 * 60 * 1000 && diff <= MAX_FORECAST_DAYS * 24 * 3600 * 1000;
}

export function buildForecastUrl(): string {
  const params = new URLSearchParams({
    latitude: String(DARICA.latitude),
    longitude: String(DARICA.longitude),
    hourly: 'temperature_2m,weathercode',
    timezone: 'Europe/Istanbul',
    forecast_days: String(MAX_FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** WMO hava kodu -> Türkçe etiket. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Açık';
  if (code === 1) return 'Çoğunlukla açık';
  if (code === 2) return 'Parçalı bulutlu';
  if (code === 3) return 'Kapalı';
  if (code === 45 || code === 48) return 'Sisli';
  if (code >= 51 && code <= 57) return 'Çiseleme';
  if (code >= 61 && code <= 67) return 'Yağmurlu';
  if (code >= 71 && code <= 77) return 'Karlı';
  if (code >= 80 && code <= 82) return 'Sağanak yağmur';
  if (code === 85 || code === 86) return 'Kar sağanağı';
  if (code === 95) return 'Gök gürültülü fırtına';
  if (code === 96 || code === 99) return 'Dolu ve fırtına';
  return 'Bilinmiyor';
}

interface HourlyPayload {
  hourly?: { time?: unknown; temperature_2m?: unknown; weathercode?: unknown };
}

/** Maç saatine en yakın (yuvarlanmış) saatlik girdiyi seçer; saat dilimi Europe/Istanbul. */
export function pickHour(payload: unknown, matchEpoch: number): { at: string; temperatureC: number; weatherCode: number } | null {
  const hourly = (payload as HourlyPayload | null)?.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.temperature_2m) || !Array.isArray(hourly.weathercode)) return null;
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < hourly.time.length; i += 1) {
    const t = hourly.time[i];
    if (typeof t !== 'string') continue;
    const epoch = parseMatchTime(t);
    if (epoch === null) continue;
    const diff = Math.abs(epoch - matchEpoch);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  if (best < 0 || bestDiff > 30 * 60 * 1000) return null;
  const temp = hourly.temperature_2m[best];
  const code = hourly.weathercode[best];
  if (typeof temp !== 'number' || typeof code !== 'number' || !Number.isFinite(temp)) return null;
  return { at: hourly.time[best] as string, temperatureC: Math.round(temp), weatherCode: code };
}

/** Ağ çağrısı enjekte edilir; her hata/zaman aşımı/uygunsuzluk { available:false } olur, sabit değer yok. */
export async function getWeatherForMatch(
  at: string,
  now: Date,
  fetcher: FetchLike,
  timeoutMs: number = WEATHER_TIMEOUT_MS,
): Promise<WeatherResult> {
  const matchEpoch = parseMatchTime(at);
  if (matchEpoch === null || !isForecastable(matchEpoch, now)) return unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(buildForecastUrl(), { signal: controller.signal });
    if (!response.ok) return unavailable();
    const picked = pickHour(await response.json(), matchEpoch);
    if (!picked) return unavailable();
    return { available: true, source: WEATHER_SOURCE, ...picked, label: weatherLabel(picked.weatherCode) };
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
  }
}

// Modül içi bellek önbelleği: tahmin yanıtı (tüm saatler) 30 dk tutulur; maç başına çağrı değil, tek kaynak çağrısı.
interface CacheEntry { expires: number; payload: unknown }
let cache: CacheEntry | null = null;

export function clearWeatherCache(): void { cache = null; }

export async function getWeatherCached(at: string, now: Date, fetcher: FetchLike, timeoutMs?: number): Promise<WeatherResult> {
  const matchEpoch = parseMatchTime(at);
  if (matchEpoch === null || !isForecastable(matchEpoch, now)) return unavailable();
  const cachedFetcher: FetchLike = async (url, init) => {
    if (cache && cache.expires > now.getTime()) return { ok: true, json: async () => cache!.payload };
    const response = await fetcher(url, init);
    if (!response.ok) return response;
    const payload = await response.json();
    cache = { expires: now.getTime() + CACHE_TTL_MS, payload };
    return { ok: true, json: async () => payload };
  };
  return getWeatherForMatch(at, now, cachedFetcher, timeoutMs);
}
