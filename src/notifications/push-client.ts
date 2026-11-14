function toApplicationServerKey(base64Url: string): Uint8Array {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function isBrowserPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

export async function currentBrowserSubscription(): Promise<PushSubscription | null> {
  if (!isBrowserPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() ?? null;
}

export async function enableBrowserPush(vapidPublicKey: string): Promise<PushSubscription> {
  if (!isBrowserPushSupported()) {
    throw new Error('Bu tarayıcı veya cihaz Web Push bildirimlerini desteklemiyor.');
  }
  if (!vapidPublicKey) throw new Error('Bildirim anahtarı yapılandırılmamış.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Tarayıcı bildirim iznini reddetti. Cihaz ayarlarından izin verebilirsin.'
      : 'Bildirim izni verilmedi.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toApplicationServerKey(vapidPublicKey),
  });

  const response = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!response.ok) {
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error('Bu cihaz bildirim listesine kaydedilemedi.');
  }
  return subscription;
}

export async function disableBrowserPush(): Promise<void> {
  if (!isBrowserPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const response = await fetch('/api/push-unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) throw new Error('Bildirim kaydı sunucudan kaldırılamadı.');
  await subscription.unsubscribe();
}
