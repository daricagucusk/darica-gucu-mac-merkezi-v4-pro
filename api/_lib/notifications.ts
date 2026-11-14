import { randomUUID } from 'node:crypto';
import {
  PATH_NOTIFICATION_STORE,
  readJSON,
  writeJSON,
} from './blob-store.js';
import { sendPushToAll } from './push.js';

export type NotificationType =
  | 'askf_pending_review'
  | 'askf_approved'
  | 'askf_rejected'
  | 'match_reminder'
  | 'source_issue';

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  href: string;
  dedupeKey: string;
}

export interface StoredPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
  lastSuccessAt?: string;
  userAgent?: string;
}

interface NotificationStore {
  schema: 1;
  notifications: NotificationRecord[];
  subscriptions: StoredPushSubscription[];
}

const EMPTY_STORE: NotificationStore = {
  schema: 1,
  notifications: [],
  subscriptions: [],
};

export async function readNotificationStore(): Promise<NotificationStore> {
  const store = await readJSON<NotificationStore>(PATH_NOTIFICATION_STORE);
  if (!store || store.schema !== 1) return structuredClone(EMPTY_STORE);
  return {
    schema: 1,
    notifications: Array.isArray(store.notifications) ? store.notifications.slice(0, 100) : [],
    subscriptions: Array.isArray(store.subscriptions) ? store.subscriptions.slice(0, 30) : [],
  };
}

async function persistStore(store: NotificationStore): Promise<void> {
  store.notifications = store.notifications.slice(0, 100);
  store.subscriptions = store.subscriptions.slice(0, 30);
  await writeJSON(PATH_NOTIFICATION_STORE, store);
}

export async function createNotification(input: {
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
  push?: boolean;
}): Promise<{ created: boolean; notification: NotificationRecord }> {
  const store = await readNotificationStore();
  const existing = store.notifications.find((item) => item.dedupeKey === input.dedupeKey);
  if (existing) return { created: false, notification: existing };

  const notification: NotificationRecord = {
    id: randomUUID(),
    type: input.type,
    title: input.title.slice(0, 100),
    body: input.body.slice(0, 240),
    createdAt: new Date().toISOString(),
    readAt: null,
    href: input.href,
    dedupeKey: input.dedupeKey.slice(0, 220),
  };
  store.notifications.unshift(notification);
  await persistStore(store);

  if (input.push !== false && store.subscriptions.length) {
    const delivery = await sendPushToAll(store.subscriptions, {
      title: notification.title,
      body: notification.body,
      href: notification.href,
      notificationId: notification.id,
    });
    if (delivery.expiredEndpoints.length) {
      const expired = new Set(delivery.expiredEndpoints);
      store.subscriptions = store.subscriptions.filter((item) => !expired.has(item.endpoint));
      await persistStore(store);
    }
  }
  return { created: true, notification };
}

export async function listNotifications(): Promise<{
  notifications: NotificationRecord[];
  unreadCount: number;
}> {
  const store = await readNotificationStore();
  const notifications = store.notifications.slice(0, 40);
  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.readAt).length,
  };
}

export async function markNotificationRead(id: string | 'all'): Promise<void> {
  const store = await readNotificationStore();
  const now = new Date().toISOString();
  store.notifications = store.notifications.map((item) =>
    id === 'all' || item.id === id
      ? { ...item, readAt: item.readAt ?? now }
      : item,
  );
  await persistStore(store);
}

export async function upsertPushSubscription(
  subscription: Omit<StoredPushSubscription, 'createdAt'>,
  userAgent?: string,
): Promise<void> {
  const store = await readNotificationStore();
  const existing = store.subscriptions.find((item) => item.endpoint === subscription.endpoint);
  const next: StoredPushSubscription = {
    ...subscription,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...(userAgent ? { userAgent: userAgent.slice(0, 240) } : {}),
    ...(existing?.lastSuccessAt ? { lastSuccessAt: existing.lastSuccessAt } : {}),
  };
  store.subscriptions = [
    next,
    ...store.subscriptions.filter((item) => item.endpoint !== subscription.endpoint),
  ].slice(0, 30);
  await persistStore(store);
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const store = await readNotificationStore();
  store.subscriptions = store.subscriptions.filter((item) => item.endpoint !== endpoint);
  await persistStore(store);
}
