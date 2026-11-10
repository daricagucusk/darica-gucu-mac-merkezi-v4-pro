import { useEffect, useMemo, useState } from 'react';

type Match = {
  id: string;
  group: string;
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
  status: 'scheduled' | 'postponed' | 'cancelled';
};

type SourceStatus = {
  state: string;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  schedule?: string;
  sourceFile?: string;
  sourceWeek?: number;
  sourceSeason?: string;
  matchesCount?: number;
  daricaMatchCount?: number;
};

type LiveData = {
  status: string;
  freshness?: string;
  sourceStatus?: string;
  sourceFile?: string;
  sourceWeek?: number;
  season?: string;
  sourceHash?: string;
  checkedAt?: string;
  matches: Match[];
  daricaMatches: Match[];
};

const navigation = ['Maç Merkezi', 'Kulüplerim', 'Saha Merkezi', 'Paylaşım Stüdyosu', 'Değişiklikler', 'ASKF Yönetimi'];
const mobileNavigation = [
  { label: 'Maç', index: 0 },
  { label: 'Kulüpler', index: 1 },
  { label: 'Sahalar', index: 2 },
  { label: 'Diğer', index: 5 },
];

const initialStatus: SourceStatus = {
  state: 'awaiting_first_run',
  lastSuccess: null,
  lastAttempt: null,
  lastError: null,
};

const initialLive: LiveData = {
  status: 'not_configured',
  matches: [],
  daricaMatches: [],
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(`${value}T12:00:00+03:00`));
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Henüz yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

function sourceStateLabel(state: string, stale: boolean): string {
  if (stale) return 'STALE · SON DOĞRULANMIŞ VERİ';
  switch (state) {
    case 'verified': return 'VERIFIED';
    case 'running': return 'KONTROL EDİLİYOR';
    case 'refresh_failed': return 'YENİLEME BAŞARISIZ';
    case 'not_configured': return 'YAPILANDIRILMADI';
    default: return 'AWAITING FIRST RUN';
  }
}

function App() {
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>(initialStatus);
  const [live, setLive] = useState<LiveData>(initialLive);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [statusResponse, liveResponse] = await Promise.all([
          fetch('/api/source-status', { cache: 'no-store' }),
          fetch('/api/live', { cache: 'no-store' }),
        ]);
        if (!statusResponse.ok || !liveResponse.ok) throw new Error('Maç merkezi verisi alınamadı.');
        const [statusData, liveData] = await Promise.all([
          statusResponse.json() as Promise<SourceStatus>,
          liveResponse.json() as Promise<LiveData>,
        ]);
        if (active) {
          setSourceStatus(statusData);
          setLive(liveData);
          setLoadError(false);
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, []);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const nextMatch = useMemo(() => live.daricaMatches
    .filter((match) => match.date >= today && match.status === 'scheduled')
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0], [live.daricaMatches, today]);

  const verified = live.status === 'verified';
  const stale = live.freshness === 'stale' || sourceStatus.state === 'refresh_failed';
  const bannerTitle = stale
    ? 'Yenileme başarısız — son doğrulanmış program korunuyor'
    : verified
      ? 'ASKF programı doğrulandı'
      : sourceStatus.state === 'running'
        ? 'ASKF programı kontrol ediliyor'
        : 'İlk resmî ASKF doğrulaması bekleniyor';

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Ana gezinme">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">DG</div>
          <div>
            <strong>Darıca Gücü</strong>
            <span>MAÇ MERKEZİ <b>V4 PRO</b></span>
          </div>
        </div>
        <div className="nav-label">OPERASYON</div>
        <nav>
          {navigation.map((item, index) => (
            <button className={index === 0 ? 'nav-item active' : 'nav-item'} key={item} type="button" disabled={index !== 0} aria-current={index === 0 ? 'page' : undefined}>
              <span className="nav-index">{String(index + 1).padStart(2, '0')}</span>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={verified && !stale ? 'status-dot healthy' : 'status-dot'} />
          <span>V4 GELİŞTİRME SÜRÜMÜ</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">DARICA GÜCÜ SPOR KULÜBÜ</span>
            <h1>Maç Merkezi</h1>
          </div>
          <div className="topbar-meta">
            <span className="environment">İZOLE V4</span>
            <span className="date-label">{new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date()).toLocaleUpperCase('tr-TR')}</span>
          </div>
        </header>

        <section className={verified && !stale ? 'source-banner healthy' : 'source-banner'} aria-labelledby="source-heading">
          <div className="source-icon" aria-hidden="true">{verified && !stale ? '✓' : '!'}</div>
          <div className="source-copy">
            <span className="eyebrow">VERİ KAYNAĞI DURUMU</span>
            <h2 id="source-heading">{bannerTitle}</h2>
            <p>{verified
              ? `${live.sourceFile ?? sourceStatus.sourceFile ?? 'ASKF Excel'} · ${live.season ?? sourceStatus.sourceSeason ?? ''} · ${live.matches.length} karşılaşma`
              : 'Doğrulanmış program oluşana kadar eski veya örnek maçlar canlı fikstür gibi gösterilmez.'}</p>
          </div>
          <span className={verified && !stale ? 'state-pill healthy' : 'state-pill'}>{sourceStateLabel(sourceStatus.state, stale)}</span>
        </section>

        <section className="next-match-panel">
          <div className="next-match-heading">
            <span className="eyebrow">DARICA GÜCÜ · SIRADAKİ MAÇ</span>
            <span className="muted-label">Resmî programdan</span>
          </div>
          {nextMatch ? (
            <div className="next-match-content">
              <div className="next-match-date">
                <strong>{formatDate(nextMatch.date)}</strong>
                <span>{nextMatch.time}</span>
              </div>
              <div className="next-match-teams">
                <strong>{nextMatch.home}</strong>
                <span>VS</span>
                <strong>{nextMatch.away}</strong>
              </div>
              <div className="next-match-meta">
                <span className="category-pill">{nextMatch.group}</span>
                <span>{nextMatch.venue}</span>
              </div>
            </div>
          ) : (
            <div className="next-match-empty">
              {loading ? 'Doğrulanmış maç programı yükleniyor…' : verified
                ? 'Bu program aralığında yaklaşan Darıca Gücü maçı listelenmiyor.'
                : 'Sıradaki maç, ASKF kaynağı doğrulandıktan sonra gösterilecek.'}
            </div>
          )}
        </section>

        <section className="workspace-grid">
          <div className="schedule-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">KOCAELİ · U11–U19</span>
                <h2>Haftalık maç programı</h2>
              </div>
              <span className="muted-label">{verified ? `${live.matches.length} maç` : 'Kaynak doğrulaması gerekli'}</span>
            </div>
            {live.matches.length > 0 ? (
              <div className="match-list">
                {live.matches.slice(0, 12).map((match) => (
                  <article className="match-row" key={match.id}>
                    <div className="match-time">
                      <strong>{match.time}</strong>
                      <span>{formatDate(match.date)}</span>
                    </div>
                    <div className="match-teams">
                      <strong>{match.home}</strong>
                      <span>—</span>
                      <strong>{match.away}</strong>
                    </div>
                    <div className="match-meta">
                      <span className="category-pill">{match.group}</span>
                      <span className="venue-name">{match.venue}</span>
                    </div>
                    <span className={match.status === 'scheduled' ? 'match-status' : 'match-status attention'}>
                      {match.status === 'scheduled' ? 'Programda' : match.status === 'postponed' ? 'Ertelendi' : 'İptal'}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-symbol" aria-hidden="true">—</div>
                <h3>{loadError ? 'Maç verisi şu anda alınamıyor' : 'Doğrulanmış maç verisi henüz yok'}</h3>
                <p>{loadError
                  ? 'Bağlantı veya kaynak servisi geçici olarak yanıt vermiyor. Son doğrulanmış program varsa korunur.'
                  : 'ASKF kaynağı başarıyla taranıp Excel dosyası doğrulandığında karşılaşmalar burada listelenecek.'}</p>
                <span className="empty-note">Programda maç görünmemesi, sahanın kesin olarak boş olduğu anlamına gelmez.</span>
              </div>
            )}
          </div>

          <aside className="source-panel">
            <span className="eyebrow">KAYNAK KONTROLÜ</span>
            <h2>ASKF bağlantısı</h2>
            <dl>
              <div><dt>Kaynak</dt><dd>Kocaeli ASKF</dd></div>
              <div><dt>Son başarılı kontrol</dt><dd>{formatTimestamp(sourceStatus.lastSuccess)}</dd></div>
              <div><dt>Son deneme</dt><dd>{formatTimestamp(sourceStatus.lastAttempt)}</dd></div>
              <div><dt>Kaynak dosyası</dt><dd>{live.sourceFile ?? sourceStatus.sourceFile ?? 'Henüz yok'}</dd></div>
              <div><dt>Hafta / sezon</dt><dd>{live.sourceWeek ? `${live.sourceWeek}. · ${live.season ?? ''}` : 'Henüz yok'}</dd></div>
            </dl>
            <div className={stale ? 'source-footnote warning' : 'source-footnote'}>
              {stale && sourceStatus.lastError
                ? sourceStatus.lastError
                : verified
                  ? `SHA-256: ${live.sourceHash?.slice(0, 12) ?? '—'}…`
                  : 'Kaynak doğrulanmadan fikstür yayımlanmaz.'}
            </div>
          </aside>
        </section>

        <footer className="app-footer">
          <span>V4 PRO · İZOLE GELİŞTİRME</span>
          <span>ORİJİNAL VE V3 CANLI SİSTEMLER KORUNUYOR</span>
        </footer>
      </main>

      <nav className="mobile-nav" aria-label="Mobil gezinme">
        {mobileNavigation.map((item) => (
          <button key={item.label} type="button" className={item.index === 0 ? 'mobile-nav-item active' : 'mobile-nav-item'} disabled={item.index !== 0} aria-current={item.index === 0 ? 'page' : undefined}>
            <span className="mobile-nav-mark">{String(item.index + 1).padStart(2, '0')}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
