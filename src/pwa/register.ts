type Listener = (state: { updateReady: boolean }) => void;

const listeners = new Set<Listener>();
let waitingWorker: ServiceWorker | null = null;
let reloading = false;

function emit(): void {
  for (const listener of listeners) listener({ updateReady: waitingWorker !== null });
}

export function subscribePwa(listener: Listener): () => void {
  listeners.add(listener);
  listener({ updateReady: waitingWorker !== null });
  return () => { listeners.delete(listener); };
}

/** Kullanıcı "Yenile" dediğinde bekleyen yeni sürümü etkinleştirir. */
export function applyServiceWorkerUpdate(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      const track = (worker: ServiceWorker | null) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          // Yeni sürüm yüklendi ve eskisi hâlâ denetimde: kullanıcıya sor.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = worker;
            emit();
          }
        });
      };
      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        emit();
      }
      registration.addEventListener('updatefound', () => track(registration.installing));
      // Uzun süre açık kalan PWA için saatlik güncelleme kontrolü.
      window.setInterval(() => { void registration.update().catch(() => undefined); }, 60 * 60 * 1000);
    }).catch(() => {
      // Servis çalışanı engellenirse uygulama içi bildirimler ve canlı veri çalışmaya devam eder.
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
