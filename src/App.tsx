import { useEffect, useMemo, useState } from 'react';
import AskfReviewPanel from './components/AskfReviewPanel';
import Dashboard from './components/Dashboard';
import PosterStudio from './components/PosterStudio';
import NotificationCenter from './components/NotificationCenter';
import { buildDashboardMetrics } from './dashboard/metrics';
import type { PosterFixture } from './poster/poster-utils';
import {
  addTrackedName,
  matchesForClub,
  matchesForVenue,
  normalizeClubKey,
  removeTrackedName,
  venuesFrom,
} from './domain/tracking';

type Match = {
  id: string;
  group: string;
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
  field?: string;
  status: 'scheduled' | 'postponed' | 'cancelled';
  sourceRow?: number;
};
type Change = {
  fixtureId: string;
  type: string;
  status?: 'verification_required';
  previous?: Partial<Match>;
  current?: Partial<Match>;
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
  sourceHash?: string;
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
  changes?: Change[];
  notices?: string[];
};

const PRIMARY = 'Darıca Gücü Spor';
const navigation = [
  { id: 'dashboard', label: 'Kontrol Merkezi', short: 'Özet' },
  { id: 'matches', label: 'Maç Merkezi', short: 'Maç' },
  { id: 'clubs', label: 'Kulüplerim', short: 'Kulüpler' },
  { id: 'venues', label: 'Saha Merkezi', short: 'Sahalar' },
  { id: 'changes', label: 'Değişiklikler', short: 'Değişim' },
  { id: 'posters', label: 'Afiş Stüdyosu', short: 'Afiş' },
  { id: 'source', label: 'ASKF Yönetimi', short: 'ASKF' },
] as const;
type Screen = typeof navigation[number]['id'];

const initialStatus: SourceStatus = {
  state: 'awaiting_first_run',
  lastSuccess: null,
  lastAttempt: null,
  lastError: null,
};
const initialLive: LiveData = { status: 'not_configured', matches: [], daricaMatches: [], changes: [] };

function initialScreen(): Screen {
  const requested = new URLSearchParams(window.location.search).get('screen');
  return navigation.some((item) => item.id === requested) ? requested as Screen : 'dashboard';
}


function readList(key: string, fallback: string[]): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
  } catch { return fallback; }
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'short', day: '2-digit', month: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(`${value}T12:00:00+03:00`));
}
function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Henüz yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}
function stateLabel(state: string, stale: boolean): string {
  if (stale) return 'ESKİ VERİ · SON DOĞRULANMIŞ PROGRAM';
  switch (state) {
    case 'verified': return 'DOĞRULANDI';
    case 'pending_review': return 'ONAY BEKLİYOR';
    case 'running': return 'KONTROL EDİLİYOR';
    case 'refresh_failed': return 'YENİLEME BAŞARISIZ';
    case 'not_configured': return 'YAPILANDIRILMADI';
    default: return 'İLK KONTROL BEKLENİYOR';
  }
}
function changeLabel(type: string): string {
  switch (type) {
    case 'added': return 'Yeni maç';
    case 'kickoff_changed': return 'Tarih / saat değişti';
    case 'venue_changed': return 'Saha değişti';
    case 'teams_changed': return 'Takım bilgisi değişti';
    case 'missing': return 'Doğrulama gerekli';
    default: return type;
  }
}

function App() {
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>(initialStatus);
  const [live, setLive] = useState<LiveData>(initialLive);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [trackedClubs, setTrackedClubs] = useState<string[]>(() => readList('dg-v4-tracked-clubs', [PRIMARY]));
  const [trackedVenues, setTrackedVenues] = useState<string[]>(() => readList('dg-v4-tracked-venues', []));
  const [clubInput, setClubInput] = useState('');
  const [clubSearch, setClubSearch] = useState('');
  const [venueSearch, setVenueSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState('ALL');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [selectedVenue, setSelectedVenue] = useState('ALL');
  const [matchSearch, setMatchSearch] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('dg-v4-tracked-clubs', JSON.stringify(trackedClubs));
      localStorage.setItem('dg-v4-tracked-venues', JSON.stringify(trackedVenues));
    } catch { /* Private browsing can disable local persistence. */ }
  }, [trackedClubs, trackedVenues]);

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
        if (!active) return;
        setSourceStatus(statusData);
        setLive(liveData);
        setLoadError(false);
        if (liveData.status === 'verified' && liveData.matches.length > 0) {
          try { localStorage.setItem('dg-v4-last-verified', JSON.stringify(liveData)); } catch { /* Cache is optional. */ }
        }
      } catch {
        if (!active) return;
        setLoadError(true);
        try {
          const cached = localStorage.getItem('dg-v4-last-verified');
          if (cached) {
            const parsed = JSON.parse(cached) as LiveData;
            if (parsed.status === 'verified' && Array.isArray(parsed.matches)) {
              setLive({ ...parsed, freshness: 'stale' });
              setSourceStatus((current) => ({ ...current, state: 'refresh_failed' }));
            }
          }
        } catch { /* Ignore invalid local cache; never invent fallback fixtures. */ }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, []);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const allMatches = live.matches ?? [];
  const daricaMatches = live.daricaMatches ?? [];
  const nextMatch = useMemo(() => daricaMatches
    .filter((match) => match.date >= today && match.status === 'scheduled')
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0], [daricaMatches, today]);
  const verified = live.status === 'verified';
  const stale = live.freshness === 'stale' || sourceStatus.state === 'refresh_failed';
  const dashboardMetrics = useMemo(() => buildDashboardMetrics({
    matches: allMatches,
    daricaMatches,
    trackedClubCount: trackedClubs.length,
    changes: live.changes ?? [],
    now: new Date(),
    sourceState: sourceStatus.state,
    freshness: live.freshness,
  }), [allMatches, daricaMatches, trackedClubs.length, live.changes, sourceStatus.state, live.freshness]);
  const posterFixtures: PosterFixture[] = daricaMatches.map((match) => ({
    id: match.id,
    group: match.group,
    date: match.date,
    time: match.time,
    home: match.home,
    away: match.away,
    venue: match.venue,
    status: match.status,
  }));

  const groups = useMemo(() => [...new Set(allMatches.map((match) => match.group))].sort(), [allMatches]);
  const venues = useMemo(() => venuesFrom(allMatches), [allMatches]);
  const filteredMatches = useMemo(() => {
    let result = allMatches;
    if (selectedClub !== 'ALL') result = matchesForClub(result, selectedClub);
    if (selectedGroup !== 'ALL') result = result.filter((match) => match.group === selectedGroup);
    if (selectedVenue !== 'ALL') result = matchesForVenue(result, selectedVenue);
    const query = matchSearch.trim().toLocaleLowerCase('tr-TR');
    if (query) result = result.filter((match) =>
      [match.home, match.away, match.venue, match.group].some((value) => value.toLocaleLowerCase('tr-TR').includes(query)),
    );
    return [...result].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }, [allMatches, selectedClub, selectedGroup, selectedVenue, matchSearch]);
  const filteredVenues = venues.filter((venue) => venue.toLocaleLowerCase('tr-TR').includes(venueSearch.toLocaleLowerCase('tr-TR')));
  function addClub(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = addTrackedName(trackedClubs, clubInput);
    if (next.length !== trackedClubs.length) {
      setTrackedClubs(next);
      setClubInput('');
    }
  }
  function addVenue(venue: string) {
    setTrackedVenues((current) => current.includes(venue) ? current : [...current, venue]);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Ana gezinme">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">DG</div>
          <div><strong>Darıca Gücü</strong><span>MAÇ MERKEZİ <b>V4 PRO</b></span></div>
        </div>
        <div className="nav-label">OPERASYON</div>
        <nav>
          {navigation.map((item, index) => (
            <button className={screen === item.id ? 'nav-item active' : 'nav-item'} key={item.id} type="button" onClick={() => setScreen(item.id)} aria-current={screen === item.id ? 'page' : undefined}>
              <span className="nav-index">{String(index + 1).padStart(2, '0')}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className={verified && !stale ? 'status-dot healthy' : 'status-dot'} /><span>KULÜP KOMUTA MERKEZİ</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">DARICA GÜCÜ SPOR KULÜBÜ</span><h1>{navigation.find((item) => item.id === screen)?.label}</h1></div>
          <div className="topbar-meta"><span className="environment">V4 PRO</span><span className="date-label">{new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date()).toLocaleUpperCase('tr-TR')}</span><NotificationCenter onNavigate={setScreen}/></div>
        </header>

        {screen !== 'dashboard' && <section className={verified && !stale ? 'source-banner healthy' : 'source-banner'} aria-labelledby="source-heading">
          <div className="source-icon" aria-hidden="true">{verified && !stale ? '✓' : '!'}</div>
          <div className="source-copy"><span className="eyebrow">VERİ KAYNAĞI DURUMU</span><h2 id="source-heading">{stale ? 'Yenileme başarısız — son doğrulanmış program korunuyor' : verified ? 'ASKF programı doğrulandı' : sourceStatus.state === 'running' ? 'ASKF programı kontrol ediliyor' : 'İlk resmî ASKF doğrulaması bekleniyor'}</h2><p>{verified ? `${live.sourceFile ?? sourceStatus.sourceFile ?? 'ASKF Excel'} · ${live.season ?? sourceStatus.sourceSeason ?? ''} · ${allMatches.length} karşılaşma` : 'Doğrulanmış program oluşana kadar örnek maçlar canlı fikstür gibi gösterilmez.'}</p></div>
          <span className={verified && !stale ? 'state-pill healthy' : 'state-pill'}>{stateLabel(sourceStatus.state, stale)}</span>
        </section>}

        {screen === 'dashboard' && <Dashboard metrics={dashboardMetrics} changes={live.changes ?? []} verified={verified && !stale} lastUpdated={formatTimestamp(live.checkedAt ?? sourceStatus.lastSuccess)} onNavigate={setScreen}/>}

        {screen === 'matches' && <>
          <section className="next-match-panel">
            <div className="next-match-heading"><span className="eyebrow">DARICA GÜCÜ · SIRADAKİ MAÇ</span><span className="muted-label">Resmî programdan</span></div>
            {nextMatch ? <div className="next-match-content"><div className="next-match-date"><strong>{formatDate(nextMatch.date)}</strong><span>{nextMatch.time}</span></div><div className="next-match-teams"><strong>{nextMatch.home}</strong><span>VS</span><strong>{nextMatch.away}</strong></div><div className="next-match-meta"><span className="category-pill">{nextMatch.group}</span><span>{nextMatch.venue}</span></div></div> : <div className="next-match-empty">{loading ? 'Doğrulanmış maç programı yükleniyor…' : verified ? 'Bu program aralığında yaklaşan Darıca Gücü maçı listelenmiyor.' : 'Sıradaki maç, ASKF kaynağı doğrulandıktan sonra gösterilecek.'}</div>}
          </section>
          <section className="schedule-panel module-panel">
            <div className="section-heading"><div><span className="eyebrow">KOCAELİ · U11–U19</span><h2>Haftalık maç programı</h2></div><span className="muted-label">{verified ? `${filteredMatches.length} / ${allMatches.length} maç` : 'Kaynak doğrulaması gerekli'}</span></div>
            <div className="filter-toolbar">
              <label>Kulüp<select value={selectedClub} onChange={(event) => setSelectedClub(event.target.value)}><option value="ALL">Tüm kulüpler</option>{trackedClubs.map((club) => <option key={normalizeClubKey(club)} value={club}>{club}</option>)}</select></label>
              <label>Kategori<select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}><option value="ALL">Tüm kategoriler</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label>Saha<select value={selectedVenue} onChange={(event) => setSelectedVenue(event.target.value)}><option value="ALL">Tüm sahalar</option>{venues.map((venue) => <option key={venue}>{venue}</option>)}</select></label>
              <label className="search-filter">Ara<input value={matchSearch} onChange={(event) => setMatchSearch(event.target.value)} placeholder="Kulüp, saha, kategori" /></label>
            </div>
            {filteredMatches.length > 0 ? <div className="match-list">{filteredMatches.map((match) => <article className="match-row" key={match.id}><div className="match-time"><strong>{match.time}</strong><span>{formatDate(match.date)}</span></div><div className="match-teams"><strong>{match.home}</strong><span>—</span><strong>{match.away}</strong></div><div className="match-meta"><span className="category-pill">{match.group}</span><span className="venue-name">{match.venue}</span></div><span className={match.status === 'scheduled' ? 'match-status' : 'match-status attention'}>{match.status === 'scheduled' ? 'Programda' : match.status === 'postponed' ? 'Ertelendi' : 'İptal'}</span></article>)}</div> : <div className="empty-state"><div className="empty-symbol">—</div><h3>{verified ? 'Bu filtrelerde maç bulunamadı' : loadError ? 'Maç verisi şu anda alınamıyor' : 'Doğrulanmış maç verisi henüz yok'}</h3><p>{verified ? 'Filtreleri genişlet veya farklı bir kulüp, kategori ya da saha seç.' : 'ASKF kaynağı başarıyla taranıp Excel dosyası doğrulandığında karşılaşmalar burada listelenecek.'}</p><span className="empty-note">Programda maç görünmemesi, sahanın kesin olarak boş olduğu anlamına gelmez.</span></div>}
          </section>
        </>}

        {screen === 'clubs' && <section className="module-panel">
          <div className="section-heading"><div><span className="eyebrow">KİŞİSEL TAKİP LİSTEN</span><h2>Kulüplerim</h2></div><span className="muted-label">{trackedClubs.length} takip edilen kulüp</span></div>
          <div className="module-content"><p className="module-intro">Kulüplerini takip listene ekle. Maç programı yalnızca ASKF'nin doğrulanmış fikstüründen filtrelenir.</p>
            <form className="add-row" onSubmit={addClub}><label className="sr-only" htmlFor="club-input">Kulüp adı</label><input id="club-input" value={clubInput} onChange={(event) => setClubInput(event.target.value)} placeholder="Kulüp adı yaz…" maxLength={100}/><button className="primary-button" type="submit" disabled={!clubInput.trim()}>Kulüp ekle</button></form>
            <input className="module-search" value={clubSearch} onChange={(event) => setClubSearch(event.target.value)} placeholder="Takip edilen kulüplerde ara"/>
            <div className="management-list">{trackedClubs.filter((club) => club.toLocaleLowerCase('tr-TR').includes(clubSearch.toLocaleLowerCase('tr-TR'))).map((club) => <div className="management-row" key={normalizeClubKey(club)}><div><strong>{club}</strong><span>{matchesForClub(allMatches, club).length} karşılaşma · {verified ? 'ASKF programında' : 'Kaynak bekleniyor'}</span></div><button className="quiet-button" type="button" disabled={normalizeClubKey(club) === normalizeClubKey(PRIMARY)} onClick={() => setTrackedClubs((current) => removeTrackedName(current, club))}>Listeden çıkar</button></div>)}</div>
            <p className="quiet-note">Darıca Gücü başlangıç kulübüdür ve takip listesinden kaldırılamaz. Kulüp eklemek resmî fikstürde maç olduğu anlamına gelmez.</p>
          </div>
        </section>}

        {screen === 'venues' && <section className="module-panel">
          <div className="section-heading"><div><span className="eyebrow">SAHA VE TESİS KATALOĞU</span><h2>Saha Merkezi</h2></div><span className="muted-label">{venues.length} kaynak sahası</span></div>
          <div className="module-content"><p className="module-intro">ASKF programında geçen sahalar listelenir. Takip ettiğin sahaların programını buradan filtreleyebilirsin.</p>
            <input className="module-search" value={venueSearch} onChange={(event) => setVenueSearch(event.target.value)} placeholder="Saha veya tesis ara"/>
            <div className="management-list">{filteredVenues.map((venue) => <div className="management-row" key={venue}><div><strong>{venue}</strong><span>{matchesForVenue(allMatches, venue).length} listelenen karşılaşma · Boş olduğu anlamına gelmez</span></div><button className={trackedVenues.includes(venue) ? 'quiet-button selected' : 'quiet-button'} type="button" onClick={() => trackedVenues.includes(venue) ? setTrackedVenues((current) => current.filter((item) => item !== venue)) : addVenue(venue)}>{trackedVenues.includes(venue) ? 'Takipte' : 'Sahayı takip et'}</button></div>)}</div>
            {trackedVenues.length > 0 && <p className="quiet-note">Takip edilen sahalar: {trackedVenues.join(' · ')}</p>}
            {venues.length === 0 && <div className="empty-state"><h3>Henüz doğrulanmış saha kataloğu yok</h3><p>ASKF programı doğrulandığında sahalar otomatik listelenecek.</p></div>}
          </div>
        </section>}

        {screen === 'changes' && <section className="module-panel">
          <div className="section-heading"><div><span className="eyebrow">PROGRAM KARŞILAŞTIRMASI</span><h2>Değişiklik merkezi</h2></div><span className="muted-label">{live.changes?.length ?? 0} olay</span></div>
          <div className="module-content">{!verified ? <div className="empty-state"><h3>Değişiklik geçmişi bekleniyor</h3><p>İki doğrulanmış ASKF programı karşılaştırılmadan değişiklik ilan edilmez.</p></div> : live.changes?.length ? <div className="management-list">{live.changes.map((change, index) => <div className="management-row change-row" key={`${change.fixtureId}-${change.type}-${index}`}><div><strong>{changeLabel(change.type)}</strong><span>{change.current?.home ?? change.previous?.home ?? 'Takım'} – {change.current?.away ?? change.previous?.away ?? 'Takım'} · {change.current?.group ?? change.previous?.group ?? ''}</span><small>{change.status === 'verification_required' || change.type === 'missing' ? 'İPTAL DEĞİL · DOĞRULAMA GEREKLİ' : change.current?.date ? `${formatDate(change.current.date)} · ${change.current.time ?? ''}` : 'Kaynak değişikliği'}</small></div></div>)}</div> : <div className="empty-state"><h3>Yeni değişiklik yok</h3><p>Son doğrulanmış program ile önceki program arasında kayıtlı değişiklik bulunmuyor.</p></div>}</div>
        </section>}

        {screen === 'posters' && <PosterStudio fixtures={posterFixtures} verified={verified && !stale}/>}

        {screen === 'source' && <AskfReviewPanel onApproved={() => window.location.reload()} />}

        <footer className="app-footer"><span>DARICA GÜCÜ · V4 PRO</span><span>KOCAELİ ASKF · DOĞRULANMIŞ PROGRAM</span></footer>
      </main>

      <nav className="mobile-nav" aria-label="Mobil gezinme">
        {navigation.map((item) => <button key={item.id} type="button" className={screen === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'} onClick={() => setScreen(item.id)} aria-current={screen === item.id ? 'page' : undefined}><span className="mobile-nav-mark">{item.short.slice(0, 1)}</span><span>{item.short}</span></button>)}
      </nav>
    </div>
  );
}

export default App;
