import { upsertPushSubscription } from './_lib/notifications.js';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin, readJsonBody } from './_lib/request-security.js';

interface SubscriptionBody {
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: { p256dh?: string; auth?: string };
  };
}

function validSubscription(value: SubscriptionBody['subscription']): value is {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
} {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) return false;
  if (typeof value.keys?.p256dh !== 'string' || typeof value.keys?.auth !== 'string') return false;
  if (value.keys.p256dh.length < 16 || value.keys.auth.length < 8) return false;
  try {
    return new URL(value.endpoint).protocol === 'https:';
  } catch {
    return false;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    assertSameOrigin(req);
    const body = await readJsonBody<SubscriptionBody>(req);
    if (!validSubscription(body.subscription)) {
      res.status(400).json({ error: 'Push aboneliği geçersiz.' });
      return;
    }
    await upsertPushSubscription({
      endpoint: body.subscription.endpoint,
      expirationTime: body.subscription.expirationTime ?? null,
      keys: {
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
      },
    }, Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']);
    res.status(200).json({ status: 'subscribed' });
  } catch {
    res.status(403).json({ error: 'Push aboneliği kaydedilemedi.' });
  }
}
