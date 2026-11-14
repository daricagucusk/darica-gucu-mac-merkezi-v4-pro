import { useEffect, useState } from 'react';

type Fixture = {
  id: string;
  group: string;
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
};

type FixtureChange = {
  fixtureId: string;
  type: string;
  status?: string;
  previous?: Fixture;
  current?: Fixture;
};

type PendingReview = {
  state: 'pending_review';
  stagedAt: string;
  snapshot: {
    sourceFile: string;
    sourceWeek: number;
    season: string;
    sourceHash: string;
    checkedAt: string;
    matches: Fixture[];
    daricaMatches: Fixture[];
    changes: FixtureChange[];
  };
};

type MonitorSettings = {
  frequency: 'daily' | 'weekly';
};

type MonitorState = {
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  schedule?: string;
  sourceFile?: string;
  sourceWeek?: number;
  sourceSeason?: string;
  sourceHash?: string;
  matchesCount?: number;
  daricaMatchCount?: number;
  pending?: boolean;
  pendingHash?: string;
  pendingFile?: string;
  pendingStagedAt?: string;
  rollbackAvailable?: boolean;
  settings?: MonitorSettings;
  pendingReview?: PendingReview | null;
};

type Props = {
  onApproved?: () => void;
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Henüz yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

function formatFixture(change: FixtureChange): string {
  const fixture = change.current ?? change.previous;
  if (!fixture) return 'Karşılaşma ayrıntısı bulunamadı';
  return `${fixture.group} · ${fixture.home} – ${fixture.away}`;
}

function changeTitle(type: string): string {
  switch (type) {
    case 'added': return 'Yeni maç';
    case 'kickoff_changed': return 'Tarih / saat değişikliği';
    case 'venue_changed': return 'Saha değişikliği';
    case 'teams_changed': return 'Takım / kategori değişikliği';
    case 'missing': return 'Programda artık görünmüyor';
    default: return 'Program değişikliği';
  }
}

export default function AskfReviewPanel({ onApproved }: Props) {
  const [state, setState] = useState<MonitorState | null>(null);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refreshState() {
    const response = await fetch('/api/source-status', { cache: 'no-store' });
    if (!response.ok) throw new Error('ASKF takip durumu okunamadı.');
    const data = await response.json() as MonitorState;
    setState(data);
    setFrequency(data.settings?.frequency ?? 'weekly');
  }

  useEffect(() => {
    let active = true;
    fetch('/api/source-status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ASKF takip durumu okunamadı.');
        return await response.json() as MonitorState;
      })
      .then((data) => {
        if (!active) return;
        setState(data);
        setFrequency(data.settings?.frequency ?? 'weekly');
        setError('');
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Beklenmeyen kaynak hatası.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function runManualCheck() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/askf-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const result = await response.json() as { status?: string; reason?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? result.reason ?? 'ASKF kontrolü başarısız.');
      if (result.status === 'staged') setMessage('Yeni program indirildi ve inceleme kuyruğuna alındı.');
      else if (result.status === 'unchanged') setMessage('Kaynakta yeni bir program yok. Mevcut program güncel.');
      else if (result.status === 'pending_exists') setMessage('İncelenmeyi bekleyen bir program zaten var.');
      else if (result.status === 'skipped') setMessage(result.reason ?? 'Kontrol güvenli biçimde atlandı.');
      else setMessage('Kontrol tamamlandı.');
      await refreshState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ASKF kontrolü tamamlanamadı.');
      await refreshState().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function saveFrequency(next: 'daily' | 'weekly') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/askf-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: next }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Kontrol sıklığı kaydedilemedi.');
      setFrequency(next);
      setMessage(next === 'weekly' ? 'Haftalık kontrol Salı 18:00 olarak ayarlandı.' : 'Günlük kontrol her gün 18:00 olarak ayarlandı.');
      await refreshState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ayar kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function review(action: 'approve' | 'reject' | 'rollback') {
    const expectedHash = action === 'rollback'
      ? state?.sourceHash
      : state?.pendingReview?.snapshot.sourceHash;
    if (!expectedHash) return;
    const prompt = action === 'approve'
      ? 'Yeni ASKF programı canlı maç takvimine aktarılsın mı?'
      : action === 'reject'
        ? 'Bekleyen program reddedilsin mi? Arşiv dosyası korunacak.'
        : 'Canlı program bir önceki doğrulanmış sürüme geri alınsın mı?';
    if (!window.confirm(prompt)) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/askf-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, expectedHash }),
      });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Program işlemi tamamlanamadı.');
      setMessage(action === 'approve'
        ? 'Program onaylandı ve canlı maç takvimine aktarıldı.'
        : action === 'reject'
          ? 'Program reddedildi. Canlı maç takvimi değişmedi.'
          : 'Önceki program geri yüklendi.');
      await refreshState();
      if (action === 'approve' || action === 'rollback') onApproved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Program işlemi tamamlanamadı.');
      await refreshState().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const pending = state?.pendingReview ?? null;
  const changes = pending?.snapshot.changes ?? [];
  const count = (type: string) => changes.filter((change) => change.type === type).length;
  const verified = state?.state === 'verified' || state?.state === 'pending_review';

  return (
    <section className="module-panel askf-review-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">KASKF · OTOMATİK PROGRAM TAKİBİ</span>
          <h2>ASKF Program Takip Merkezi</h2>
        </div>
        <span className={verified ? 'state-pill healthy' : 'state-pill'}>
          {pending ? 'ONAY BEKLİYOR' : state?.state === 'verified' ? 'DOĞRULANDI' : state?.state === 'refresh_failed' ? 'KONTROL HATASI' : 'İZLEME AKTİF'}
        </span>
      </div>

      <div className="module-content">
        <p className="module-intro">KASKF resmî arşivi sunucu tarafından kontrol edilir. Yeni dosya otomatik indirilir; sen onaylamadan canlı maç programı değiştirilmez.</p>

        <div className="askf-control-grid">
          <div className="askf-setting-card">
            <span className="eyebrow">KONTROL SIKLIĞI</span>
            <label htmlFor="askf-frequency">Otomatik kontrol</label>
            <select id="askf-frequency" value={frequency} disabled={busy || loading} onChange={(event) => void saveFrequency(event.target.value as 'daily' | 'weekly')}>
              <option value="weekly">Her Salı · 18:00</option>
              <option value="daily">Her gün · 18:00</option>
            </select>
            <span className="quiet-note">Saat dilimi: Türkiye (UTC+3). Uygulama kapalıyken de sunucu kontrol eder.</span>
          </div>
          <div className="askf-setting-card">
            <span className="eyebrow">SON KONTROL</span>
            <strong>{formatTimestamp(state?.lastAttempt)}</strong>
            <span className="muted-label">Son başarılı indirme: {formatTimestamp(state?.lastSuccess)}</span>
            <button className="primary-button askf-check-button" type="button" disabled={busy || loading || Boolean(pending)} onClick={() => void runManualCheck()}>
              {busy ? 'İŞLEM YAPILIYOR…' : 'ŞİMDİ KONTROL ET'}
            </button>
          </div>
        </div>

        <div className="askf-metrics">
          <div><span>Kaynak</span><strong>KASKF resmî arşivi</strong></div>
          <div><span>Son dosya</span><strong>{state?.sourceFile ?? 'Henüz indirilmedi'}</strong></div>
          <div><span>Hafta / sezon</span><strong>{state?.sourceWeek ? `${state.sourceWeek}. hafta · ${state.sourceSeason ?? ''}` : '—'}</strong></div>
          <div><span>Canlı fikstür</span><strong>{state?.matchesCount ?? 0} maç</strong></div>
        </div>

        {message && <p className="askf-feedback success" role="status">{message}</p>}
        {error && <p className="askf-feedback error" role="alert">{error}</p>}
        {state?.lastError && <p className="askf-feedback error" role="status">{state.lastError}</p>}
        {loading && <p className="quiet-note">ASKF takip durumu yükleniyor…</p>}

        {pending && (
          <section className="askf-pending-card" aria-labelledby="askf-pending-title">
            <div className="askf-pending-heading">
              <div>
                <span className="eyebrow">YENİ PROGRAM İNDİRİLDİ</span>
                <h3 id="askf-pending-title">{pending.snapshot.sourceFile}</h3>
                <p>{pending.snapshot.sourceWeek}. hafta · {pending.snapshot.season} · {pending.snapshot.matches.length} karşılaşma</p>
              </div>
              <span className="state-pill">ONAY GEREKLİ</span>
            </div>
            <div className="askf-change-summary">
              <div><strong>{count('added')}</strong><span>Yeni maç</span></div>
              <div><strong>{count('kickoff_changed')}</strong><span>Tarih / saat</span></div>
              <div><strong>{count('venue_changed')}</strong><span>Saha</span></div>
              <div><strong>{count('teams_changed')}</strong><span>Takım / kategori</span></div>
              <div><strong>{count('missing')}</strong><span>Doğrulama</span></div>
            </div>
            <div className="askf-diff-list">
              {changes.length ? changes.map((change, index) => (
                <article className="askf-diff-row" key={`${change.fixtureId}-${change.type}-${index}`}>
                  <div>
                    <strong>{changeTitle(change.type)}</strong>
                    <span>{formatFixture(change)}</span>
                    {change.type === 'missing' && <small>İPTAL DEĞİL · RESMÎ OLARAK DOĞRULANMALI</small>}
                  </div>
                  <span className="muted-label">{change.current?.date ?? change.previous?.date ?? ''} {change.current?.time ?? change.previous?.time ?? ''}</span>
                </article>
              )) : <p className="quiet-note">Önceki programa göre kayıtlı fikstür değişikliği bulunmuyor.</p>}
            </div>
            <div className="askf-source-meta">
              <span>İndirme: {formatTimestamp(pending.stagedAt)}</span>
              <span>SHA-256: {pending.snapshot.sourceHash.slice(0, 18)}…</span>
            </div>
            <div className="askf-review-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => void review('approve')}>PROGRAMI ONAYLA</button>
              <button className="quiet-button" type="button" disabled={busy} onClick={() => void review('reject')}>REDDET</button>
            </div>
          </section>
        )}

        {!pending && state?.rollbackAvailable && (
          <div className="askf-rollback-row">
            <div><strong>Önceki doğrulanmış sürüm arşivde</strong><span>Gerekirse son canlı programa geri dönebilirsin.</span></div>
            <button className="quiet-button" type="button" disabled={busy} onClick={() => void review('rollback')}>ÖNCEKİ SÜRÜME DÖN</button>
          </div>
        )}

        <div className="askf-safety-note">
          <strong>Canlı program koruması</strong>
          <span>Otomatik kontrol yalnızca arşiv ve bekleyen inceleme kaydı oluşturur. Onay verilmeden fikstürler eklenmez, değiştirilmez veya silinmez. Eksik maçlar iptal kabul edilmez.</span>
        </div>

        <a className="askf-source-link" href="https://www.kaskf.org/HaftalikProgram" target="_blank" rel="noreferrer">KASKF resmî haftalık program arşivini aç ↗</a>
      </div>
    </section>
  );
}
