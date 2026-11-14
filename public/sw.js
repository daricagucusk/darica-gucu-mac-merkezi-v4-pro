self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Darıca Gücü', body: event.data ? event.data.text() : 'Yeni bir kulüp bildirimi var.' };
  }

  const title = typeof payload.title === 'string' ? payload.title.slice(0, 100) : 'Darıca Gücü';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'Kulüp merkezinde yeni bir bildirim var.';
  const href = typeof payload.href === 'string' ? payload.href : 'dashboard';
  const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId : '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: notificationId || undefined,
      renotify: false,
      data: { href, notificationId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = typeof event.notification.data?.href === 'string'
    ? event.notification.data.href.replace(/^#?\/?/, '')
    : 'dashboard';
  const target = new URL('/?screen=' + encodeURIComponent(href), self.location.origin).toString();

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        const focused = await client.focus();
        if ('navigate' in focused) await focused.navigate(target);
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
