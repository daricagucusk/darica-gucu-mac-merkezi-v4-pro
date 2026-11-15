import type { ApiRequest, ApiResponse } from './_lib/http.js';
import playersHandler from './_lib/players-handler.js';
import playerPhotoHandler from './_lib/player-photo-handler.js';
import weatherHandler from './_lib/weather-handler.js';

// Tek fonksiyon (Vercel Hobby fonksiyon sınırı). Dış adresler vercel.json rewrites ile korunur:
// /api/players, /api/player-photo, /api/weather -> /api/media?resource=...
type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void>;
const HANDLERS: Record<string, Handler> = {
  players: playersHandler,
  'player-photo': playerPhotoHandler,
  weather: weatherHandler,
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const resource = new URL(req.url ?? '/', 'http://localhost').searchParams.get('resource') ?? '';
  const target = Object.prototype.hasOwnProperty.call(HANDLERS, resource) ? HANDLERS[resource] : undefined;
  if (!target) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.status(404).json({ error: 'Bilinmeyen kaynak.' });
    return;
  }
  await target(req, res);
}
