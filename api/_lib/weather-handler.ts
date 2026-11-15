import type { ApiRequest, ApiResponse } from './http.js';
import { getWeatherCached, unavailable, type FetchLike } from './weather.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const at = new URL(req.url ?? '/', 'http://localhost').searchParams.get('at') ?? '';
  const result = at ? await getWeatherCached(at, new Date(), fetch as unknown as FetchLike) : unavailable();
  // Kamuya açık hava verisi (kişisel veri yok); CDN 30 dk tutar. Kullanılamaz yanıt kısa süre tutulur.
  res.setHeader(
    'Cache-Control',
    result.available ? 'public, s-maxage=1800, stale-while-revalidate=600' : 'public, s-maxage=60',
  );
  res.status(200).json(result);
}
