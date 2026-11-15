import { useEffect, useState } from 'react';
import AiAssistCard from './AiAssistCard';
import './askf-review.css';

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

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function formatMatchDate(date: string, time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return [date, time].filter(Boolean).join(' • ');
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const label = `${match[3]} ${MONTHS[parsed.getUTCMonth()]} ${WEEKDAYS[parsed.getUTCDay()]}`;
  return time ? `${label} • ${time}` : label;
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return 'Henüz yok';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return formatTimestamp(value);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} sa önce`;
  return formatTimestamp(value);
}

const isClubTeam = (name: string) => /dar[ıi]ca\s*g[üu]c[üu]/i.test(name);

type IconName = 'doc' | 'shield' | 'filter' | 'calendar' | 'edit' | 'send' | 'history' | 'download' | 'undo' | 'check' | 'busy' | 'sync';

const ICON_PATHS: Record<IconName, string> = {
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  filter: 'M4 5h16l-6 7v6l-4 2v-8z',
  calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  edit: 'M4 20l1-4 11-11 3 3L8 19zM14 7l3 3',
  send: 'M3 4l18 8-18 8 2-8zM5 12h8',
  history: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4M12 8v4l3 2',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  undo: 'M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 8',
  check: 'M5 12l5 5 9-10',
  busy: 'M12 3v4M12 17v4M3 12h4M17 12h4',
  sync: 'M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4',
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="askf-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
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
  const statusLabel = pending ? 'ONAY BEKLİYOR' : state?.state === 'verified' ? 'DOĞRULANDI' : state?.state === 'refresh_failed' ? 'KONTROL HATASI' : 'İZLEME AKTİF';
  const healthy = Boolean(state) && !state?.lastError && state?.state !== 'refresh_failed';
  const clubMatches = pending?.snapshot.daricaMatches ?? [];
  const groups = clubMatches.reduce<Map<string, Fixture[]>>((map, fixture) => {
    map.set(fixture.group, [...(map.get(fixture.group) ?? []), fixture]);
    return map;
  }, new Map());

  return (
    <section className="askf-review-panel" aria-labelledby="askf-review-title">
      <h2 id="askf-review-title" className="askf-sr-only">ASKF Veri Merkezi</h2>

      <section className="askf-status-band" aria-label="ASKF takip durumu">
        <div className="askf-status-row">
          <span className={healthy ? 'askf-live-label is-ok' : 'askf-live-label'}>
            <i aria-hidden="true" />
            {healthy ? 'ASKF TAKİBİ AKTİF' : 'ASKF TAKİBİ'}
          </span>
          <span className={verified ? 'askf-chip is-ok' : 'askf-chip'}>{statusLabel}</span>
        </div>
        <div className="askf-status-row askf-status-sub">
          <span className="askf-sync-text"><Icon name="sync" />Son kontrol: {relativeTime(state?.lastAttempt)}</span>
          <span className="askf-sync-text">Son indirme: {formatTimestamp(state?.lastSuccess)}</span>
        </div>
      </section>

      <section className="askf-file-card" aria-label="Kocaeli ASKF haftalık program">
        <div className="askf-file-head">
          <span className="askf-file-icon"><Icon name="doc" /></span>
          <div className="askf-file-title">
            <strong>Kocaeli ASKF Resmî Haftalık Maç Programı</strong>
            <span>Otomatik indirilir; onayınız olmadan canlı program değişmez</span>
          </div>
          {state?.sourceFile && <span className="askf-file-badge"><Icon name="check" />{state.sourceFile}</span>}
        </div>

        <div className="askf-action-grid">
          <div className="askf-select-wrap">
            <label htmlFor="askf-frequency">Otomatik kontrol</label>
            <select id="askf-frequency" value={frequency} disabled={busy || loading} onChange={(event) => void saveFrequency(event.target.value as 'daily' | 'weekly')}>
              <option value="weekly">Her Salı · 18:00</option>
              <option value="daily">Her gün · 18:00</option>
            </select>
          </div>
          <button className="askf-btn-check askf-check-button" type="button" disabled={busy || loading || Boolean(pending)} onClick={() => void runManualCheck()}>
            <Icon name={busy ? 'busy' : 'download'} />
            <span>{busy ? 'İŞLEM YAPILIYOR…' : 'ŞİMDİ KONTROL ET'}</span>
          </button>
        </div>

        <div className="askf-quality-card">
          <div className="askf-quality-row">
            <span className="askf-micro">KAYNAK · KASKF RESMÎ ARŞİVİ</span>
            <span className="askf-micro askf-micro-ok"><i aria-hidden="true" />{state?.sourceWeek ? `${state.sourceWeek}. hafta · ${state.sourceSeason ?? ''}` : '—'}</span>
          </div>
          <div className="askf-quality-row">
            <span className="askf-quality-name"><Icon name="shield" />Darıca Gücü SK</span>
            <span className="askf-count-chip">{state?.daricaMatchCount ?? 0} Müsabaka</span>
          </div>
          <div className="askf-quality-row">
            <span className="askf-micro">CANLI FİKSTÜR</span>
            <span className="askf-quality-meta">{state?.matchesCount ?? 0} maç</span>
          </div>
        </div>
        <p className="askf-note">Saat dilimi: Türkiye (UTC+3). Uygulama kapalıyken de sunucu kontrol eder.</p>
      </section>

      {message && <p className="askf-feedback success" role="status">{message}</p>}
      {error && <p className="askf-feedback error" role="alert">{error}</p>}
      {state?.lastError && <p className="askf-feedback error" role="status">{state.lastError}</p>}
      {state?.lastError && <AiAssistCard task="sourceFailure" />}
      {loading && <p className="askf-note">ASKF takip durumu yükleniyor…</p>}

      {pending && (
        <section className="askf-pending-card" aria-labelledby="askf-pending-title">
          <div className="askf-section-head">
            <span className="askf-section-title"><Icon name="filter" />Sabit Kulüp Filtresi</span>
            <span className="askf-section-side askf-section-side-primary">DARICA GÜCÜ SK</span>
          </div>

          <div className="askf-pending-heading">
            <div>
              <span className="askf-micro">YENİ PROGRAM İNDİRİLDİ</span>
              <h3 id="askf-pending-title">{pending.snapshot.sourceFile}</h3>
              <p>{pending.snapshot.sourceWeek}. hafta · {pending.snapshot.season} · {pending.snapshot.matches.length} karşılaşma</p>
            </div>
            <span className="askf-chip">ONAY GEREKLİ</span>
          </div>

          <div className="askf-change-summary">
            <div><strong>{count('added')}</strong><span>Yeni maç</span></div>
            <div><strong>{count('kickoff_changed')}</strong><span>Tarih / saat</span></div>
            <div><strong>{count('venue_changed')}</strong><span>Saha</span></div>
            <div><strong>{count('teams_changed')}</strong><span>Takım / kategori</span></div>
            <div><strong>{count('missing')}</strong><span>Doğrulama</span></div>
          </div>

          {[...groups.entries()].map(([group, fixtures]) => (
            <article className="askf-category-card" key={group}>
              <div className="askf-category-head">
                <span className="askf-category-title">
                  <b>{group}</b>
                  <span>{fixtures.length} Maç Aktif</span>
                </span>
                <span className="askf-chip">Onay Bekliyor</span>
              </div>
              {fixtures.map((fixture) => (
                <div className="askf-match-row" key={fixture.id}>
                  <div className="askf-match-teams">
                    <span className={isClubTeam(fixture.home) ? 'is-club' : ''}>{fixture.home}</span>
                    <em>vs</em>
                    <span className={isClubTeam(fixture.away) ? 'is-club' : ''}>{fixture.away}</span>
                  </div>
                  <div className="askf-match-meta">
                    <Icon name="calendar" />
                    <span>{formatMatchDate(fixture.date, fixture.time)}</span>
                    <i aria-hidden="true">•</i>
                    <span className="askf-match-venue">{fixture.venue}</span>
                  </div>
                </div>
              ))}
            </article>
          ))}

          {clubMatches.length === 0 && (
            <div className="askf-bay-card">
              <span className="askf-bay-icon"><Icon name="calendar" /></span>
              <div><strong>Bu programda Darıca Gücü maçı yok</strong><span>Resmî programda kulübe ait müsabaka bulunmuyor</span></div>
            </div>
          )}

          <div className="askf-section-head askf-section-head-spaced">
            <span className="askf-section-title"><Icon name="edit" />Program değişiklikleri</span>
            <span className="askf-section-side">{changes.length} kayıt</span>
          </div>
          <div className="askf-diff-list">
            {changes.length ? changes.map((change, index) => (
              <article className="askf-diff-row" key={`${change.fixtureId}-${change.type}-${index}`}>
                <div>
                  <strong>{changeTitle(change.type)}</strong>
                  <span>{formatFixture(change)}</span>
                  {change.type === 'missing' && <small>İPTAL DEĞİL · RESMÎ OLARAK DOĞRULANMALI</small>}
                </div>
                <span className="askf-diff-when">{change.current?.date ?? change.previous?.date ?? ''} {change.current?.time ?? change.previous?.time ?? ''}</span>
              </article>
            )) : <p className="askf-note">Önceki programa göre kayıtlı fikstür değişikliği bulunmuyor.</p>}
          </div>

          <div className="askf-source-meta">
            <span>İndirme: {formatTimestamp(pending.stagedAt)}</span>
            <span>SHA-256: {pending.snapshot.sourceHash.slice(0, 18)}…</span>
          </div>
          <AiAssistCard task="pendingSummary" />
          <a className="askf-download-link" href={`/api/askf-download?hash=${encodeURIComponent(pending.snapshot.sourceHash)}`}><Icon name="download" />ORİJİNAL EXCEL DOSYASINI İNDİR</a>

          <div className="askf-review-actions">
            <button className="askf-btn-approve" type="button" disabled={busy} onClick={() => void review('approve')}>
              <Icon name="send" />
              <span>ONAYLA &amp; PAYLAŞIM STÜDYOSUNA AKTAR ({clubMatches.length} MAÇ)</span>
            </button>
            <button className="askf-btn-reject" type="button" disabled={busy} onClick={() => void review('reject')}>REDDET</button>
          </div>
        </section>
      )}

      {(state?.sourceWeek || (!pending && state?.rollbackAvailable)) && (
        <section className="askf-archive" aria-label="Haftalık bülten arşivi">
          <div className="askf-section-head">
            <span className="askf-section-title"><Icon name="history" />Haftalık Bülten Arşivi</span>
            <span className="askf-section-side">Kocaeli ASKF {state?.sourceSeason ?? ''}</span>
          </div>
          {state?.sourceWeek ? (
            <div className="askf-archive-item is-active">
              <span className="askf-archive-tile">{String(state.sourceWeek).padStart(2, '0')}</span>
              <div className="askf-archive-copy">
                <strong>{String(state.sourceWeek).padStart(2, '0')}. Hafta Fikstürü<i aria-hidden="true" /></strong>
                <span>Aktif Bülten • {state.daricaMatchCount ?? 0} Maç Tanımlı</span>
              </div>
            </div>
          ) : null}
          {!pending && state?.rollbackAvailable && (
            <div className="askf-archive-item askf-rollback-row">
              <span className="askf-archive-tile"><Icon name="undo" /></span>
              <div className="askf-archive-copy">
                <strong>Önceki doğrulanmış sürüm</strong>
                <span>Gerekirse son canlı programa geri dönebilirsin</span>
              </div>
              <button className="askf-btn-icon" type="button" disabled={busy} onClick={() => void review('rollback')}>ÖNCEKİ SÜRÜME DÖN</button>
            </div>
          )}
        </section>
      )}

      <div className="askf-safety-note">
        <strong>Canlı program koruması</strong>
        <span>Otomatik kontrol yalnızca arşiv ve bekleyen inceleme kaydı oluşturur. Onay verilmeden fikstürler eklenmez, değiştirilmez veya silinmez. Eksik maçlar iptal kabul edilmez.</span>
      </div>

      <a className="askf-source-link" href="https://www.kaskf.org/HaftalikProgram" target="_blank" rel="noreferrer">KASKF resmî haftalık program arşivini aç ↗</a>
    </section>
  );
}
