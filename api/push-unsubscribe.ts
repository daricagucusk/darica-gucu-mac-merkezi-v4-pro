import { removePushSubscription } from './_lib/notifications.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin, readJsonBody } from './_lib/request-security.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    assertSameOrigin(req);
    const body = await readJsonBody<{ endpoint?: string }>(req);
    if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048) {
      res.status(400).json({ error: 'Push cihaz adresi geçersiz.' });
      return;
    }
    await removePushSubscription(body.endpoint);
    res.status(200).json({ status: 'unsubscribed' });
  } catch {
    res.status(403).json({ error: 'Push aboneliği kapatılamadı.' });
  }
}
