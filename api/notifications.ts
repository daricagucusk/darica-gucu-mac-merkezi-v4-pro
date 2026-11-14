import { listNotifications, markNotificationRead } from './_lib/notifications.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin, readJsonBody } from './_lib/request-security.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method === 'GET') {
    try {
      const state = await listNotifications();
      res.status(200).json({
        ...state,
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      });
    } catch {
      res.status(503).json({ error: 'Bildirim merkezi şu anda okunamıyor.' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    assertSameOrigin(req);
    const body = await readJsonBody<{ action?: string; id?: string }>(req);
    if (body.action === 'mark_all_read') {
      await markNotificationRead('all');
      res.status(200).json({ status: 'updated' });
      return;
    }
    if (body.action === 'mark_read' && typeof body.id === 'string' && body.id.length <= 80) {
      await markNotificationRead(body.id);
      res.status(200).json({ status: 'updated' });
      return;
    }
    res.status(400).json({ error: 'Bildirim işlemi geçersiz.' });
  } catch {
    res.status(403).json({ error: 'Bildirim işlemi doğrulanamadı.' });
  }
}
