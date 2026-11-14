import * as webpush from 'web-push';
import type { StoredPushSubscription } from './notifications.js';

export interface PushPayload {
  title: string;
  body: string;
  href: string;
  notificationId: string;
}

interface WebPushClient {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null },
    payload?: string,
    options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' },
  ): Promise<unknown>;
}

let vapidConfigured = false;

function client(): WebPushClient | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  if (!vapidConfigured) {
    (webpush as unknown as WebPushClient).setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  return webpush as unknown as WebPushClient;
}

export async function sendPushToAll(
  subscriptions: StoredPushSubscription[],
  payload: PushPayload,
): Promise<{ delivered: number; expired: number; failed: number; expiredEndpoints: string[] }> {
  const push = client();
  if (!push) return { delivered: 0, expired: 0, failed: subscriptions.length, expiredEndpoints: [] };

  let delivered = 0;
  let expired = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href: payload.href,
    notificationId: payload.notificationId,
  });

  for (const subscription of subscriptions) {
    try {
      await push.sendNotification(subscription, body, { TTL: 60 * 60, urgency: 'high' });
      delivered += 1;
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        expired += 1;
        expiredEndpoints.push(subscription.endpoint);
      } else {
        failed += 1;
      }
    }
  }

  return { delivered, expired, failed, expiredEndpoints };
}
