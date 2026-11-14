import { useEffect, useState } from 'react';
import {
  currentBrowserSubscription,
  disableBrowserPush,
  enableBrowserPush,
  isBrowserPushSupported,
} from '../notifications/push-client';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  href: string;
};

type NotificationState = {
  notifications: NotificationItem[];
  unreadCount: number;
  vapidPublicKey: string | null;
};

type Screen = 'dashboard' | 'matches' | 'clubs' | 'venues' | 'changes' | 'posters' | 'source';

type Props = {
  onNavigate: (screen: Screen) => void;
};

const DESTINATIONS: Screen[] = ['dashboard', 'matches', 'clubs', 'venues', 'changes', 'posters', 'source'];

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

function notificationIcon(type: string): string {
  if (type === 'askf_pending_review') return '⇅';
  if (type === 'match_reminder') return '◷';
  if (type === 'source_issue') return '!';
  return '✓';
}

export default function NotificationCenter({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    vapidPublicKey: null,
  });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const [response, subscription] = await Promise.all([
        fetch('/api/notifications', { cache: 'no-store' }),
        currentBrowserSubscription().catch(() => null),
      ]);
      if (!response.ok) throw new Error('Bildirimler okunamadı.');
      const data = await response.json() as NotificationState;
      setState(data);
      setPushSupported(isBrowserPushSupported());
      setPushEnabled(Boolean(subscription));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Bildirim merkezi açılamadı.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPushSupported(isBrowserPushSupported());
    void refresh();
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function setAllRead() {
    setBusy(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      if (!response.ok) throw new Error('Bildirimler güncellenemedi.');
      await refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Bildirimler güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      void fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', id: item.id }),
      }).then(() => refresh()).catch(() => undefined);
    }
    const destination = item.href.replace(/^#?\/?/, '') as Screen;
    if (DESTINATIONS.includes(destination)) onNavigate(destination);
    setOpen(false);
  }

  async function togglePush() {
    setBusy(true);
    setMessage('');
    try {
      if (pushEnabled) {
        await disableBrowserPush();
        setPushEnabled(false);
        setMessage('Bu cihazda otomatik bildirimler kapatıldı.');
      } else {
        if (!state.vapidPublicKey) throw new Error('Sunucu bildirim anahtarı yapılandırılmamış.');
        await enableBrowserPush(state.vapidPublicKey);
        setPushEnabled(true);
        setMessage('Bu cihaz otomatik bildirimlere kaydedildi.');
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Bildirim ayarı değiştirilemedi.');
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  return (
    <div className="notification-root">
      <button
        type="button"
        className={open ? 'notification-trigger active' : 'notification-trigger'}
        aria-label={`Bildirim merkezi, ${state.unreadCount} okunmamış`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">♢</span>
        {state.unreadCount > 0 && <b>{state.unreadCount > 9 ? '9+' : state.unreadCount}</b>}
      </button>

      {open && (
        <>
          <button type="button" className="notification-scrim" aria-label="Bildirim merkezini kapat" onClick={() => setOpen(false)}/>
          <aside className="notification-drawer glass-card" aria-label="Bildirim merkezi">
            <div className="notification-drawer-heading">
              <div><span className="eyebrow">KULÜP GÜNDEMİ</span><h3>Bildirimler</h3><small>{state.unreadCount} okunmamış bildirim</small></div>
              <button type="button" className="notification-close" onClick={() => setOpen(false)} aria-label="Kapat">×</button>
            </div>

            <div className="push-preference">
              <div className="push-preference-copy">
                <strong>Otomatik bildirimler</strong>
                <span>{pushSupported ? (pushEnabled ? 'Bu cihaz bildirim alabilir' : 'Bu cihaz henüz etkin değil') : 'Bu tarayıcı Web Push desteklemiyor'}</span>
              </div>
              <button type="button" className={pushEnabled ? 'push-toggle enabled' : 'push-toggle'} disabled={!pushSupported || busy} onClick={() => void togglePush()}>
                {busy ? '…' : pushEnabled ? 'Açık' : 'Etkinleştir'}
              </button>
            </div>

            {message && <p className="notification-message" role="status">{message}</p>}
            <div className="notification-list-heading">
              <span>SON BİLDİRİMLER</span>
              <button type="button" disabled={busy || state.unreadCount === 0} onClick={() => void setAllRead()}>Tümünü okundu yap</button>
            </div>
            <div className="notification-list">
              {loading && <p className="notification-empty">Bildirimler yükleniyor…</p>}
              {!loading && state.notifications.length === 0 && (
                <div className="notification-empty"><span>✦</span><strong>Şimdilik sessiz</strong><p>Yeni program, maç hatırlatması veya kaynak uyarısı burada görünecek.</p></div>
              )}
              {state.notifications.map((item) => (
                <button type="button" className={item.readAt ? 'notification-item read' : 'notification-item unread'} key={item.id} onClick={() => void openNotification(item)}>
                  <span className={`notification-item-icon type-${item.type}`}>{notificationIcon(item.type)}</span>
                  <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{timeLabel(item.createdAt)}</small></span>
                  {!item.readAt && <i aria-label="Okunmadı"/>}
                </button>
              ))}
            </div>
            <p className="notification-privacy">Bildirim izni yalnızca “Etkinleştir” düğmesine bastığında istenir. İstediğin zaman bu cihazdan kapatabilirsin.</p>
          </aside>
        </>
      )}
    </div>
  );
}
