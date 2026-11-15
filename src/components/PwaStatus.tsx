import { useEffect, useState } from 'react';
import { applyServiceWorkerUpdate, subscribePwa } from '../pwa/register';
import { readDismissed, shouldShowIosInstallHint, writeDismissed } from '../pwa/install';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Çevrimdışı bandı, güncelleme bildirimi ve "ana ekrana ekle" yönlendirmesi. */
export default function PwaStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallPromptEvent); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIosHint(shouldShowIosInstallHint(navigator.userAgent, standalone) && !readDismissed());
    const unsubscribe = subscribePwa((state) => setUpdateReady(state.updateReady));
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
      unsubscribe();
    };
  }, []);

  return (
    <div className="pwa-status" role="region" aria-label="Uygulama durumu">
      <div role="status" aria-live="polite">
        {!online && <p className="pwa-banner offline">Çevrimdışısın. Son doğrulanmış program gösteriliyor; bağlantı gelince otomatik yenilenir.</p>}
        {updateReady && (
          <p className="pwa-banner update">
            <span>Yeni sürüm hazır.</span>
            <button type="button" className="quiet-button" onClick={applyServiceWorkerUpdate}>Yenile</button>
          </p>
        )}
      </div>
      {installEvent && (
        <p className="pwa-banner install">
          <span>Uygulamayı telefonuna yükle.</span>
          <button type="button" className="primary-button" onClick={() => { void installEvent.prompt().finally(() => setInstallEvent(null)); }}>Yükle</button>
        </p>
      )}
      {iosHint && (
        <p className="pwa-banner install">
          <span>Ana ekrana eklemek için Safari'de Paylaş simgesine, sonra "Ana Ekrana Ekle"ye dokun.</span>
          <button type="button" className="quiet-button" onClick={() => { writeDismissed(); setIosHint(false); }}>Tamam</button>
        </p>
      )}
    </div>
  );
}
