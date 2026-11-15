import { useCallback, useEffect, useMemo, useState } from 'react';
import AskfReviewPanel from './components/AskfReviewPanel';
import PwaStatus from './components/PwaStatus';
import Dashboard from './components/Dashboard';
import PosterStudio from './components/PosterStudio';
import NotificationCenter from './components/NotificationCenter';
import ChangeBand from './components/ChangeBand';
import ClubCrest from './components/ClubCrest';
import FixtureCard from './components/FixtureCard';
import Icon, { type IconName } from './components/icons';
import { useToast } from './components/Toast';
import {
  changeShareText, changeTouchesDarica, diffRows, groupLabel, isVerificationOnly, shareText, titleTr,
  type FxChange, type FxMatch,
} from './components/fixture-utils';
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
const navGroups: Array<{ id: string; label: string; short: string; icon: IconName; target: Screen; screens: Screen[] }> = [
  { id: 'agenda', label: 'Haftalık Maç Ajandası', short: 'Takvim & Bülten', icon: 'calendar', target: 'dashboard', screens: ['dashboard', 'matches', 'clubs', 'venues', 'changes'] },
  { id: 'studio', label: 'Paylaşım Stüdyosu', short: 'Paylaşım', icon: 'share', target: 'posters', screens: ['posters'] },
  { id: 'sync', label: 'ASKF Otomasyon', short: 'ASKF Senkron', icon: 'file', target: 'source', screens: ['source'] },
];
const subNav: Array<{ id: Screen; label: string }> = [
  { id: 'dashboard', label: 'Ajanda' },
  { id: 'matches', label: 'Maçlar' },
  { id: 'clubs', label: 'Kulüplerim' },
  { id: 'venues', label: 'Sahalar' },
  { id: 'changes', label: 'Değişiklikler' },
];

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

  const [refreshing, setRefreshing] = useState(false);
  const loadData = useCallback(async (isActive: () => boolean = () => true) => {
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
      if (!isActive()) return;
      setSourceStatus(statusData);
      setLive(liveData);
      setLoadError(false);
      if (liveData.status === 'verified' && liveData.matches.length > 0) {
        try { localStorage.setItem('dg-v4-last-verified', JSON.stringify(liveData)); } catch { /* Cache is optional. */ }
      }
    } catch {
      if (!isActive()) return;
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
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadData(() => active);
    return () => { active = false; };
  }, [loadData]);

  async function refreshData() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

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
  const { toast, show } = useToast();
  const group = navGroups.find((item) => item.screens.includes(screen)) ?? navGroups[0];
  const healthy = verified && !stale;
  const daricaChanges = useMemo(() => (live.changes ?? []).filter(changeTouchesDarica) as FxChange[], [live.changes]);
  const critical = useMemo(() => {
    const map = new Map<string, FxChange>();
    for (const change of daricaChanges) if (!isVerificationOnly(change) && change.type !== 'added') map.set(change.current?.id ?? change.fixtureId, change);
    return map;
  }, [daricaChanges]);
  const share = async (text: string, title: string) => show(await shareText(text, title));
  const goStudio = () => setScreen('posters');
  const unavailableText = loading ? 'Doğrulanmış maç programı yükleniyor…' : verified ? 'Bu program aralığında yaklaşan Darıca Gücü maçı listelenmiyor.' : 'Sıradaki maç, ASKF kaynağı doğrulandıktan sonra gösterilecek.';

  return (
    <div className="dg-shell app-shell">
      <a className="skip-link" href="#main-content">Ana içeriğe geç</a>
      <header className="dg-header">
        <div className="dg-header-in">
          <button type="button" className="dg-brand" onClick={() => setScreen('dashboard')} aria-label="Darıca Gücü, ana sayfa">
            <span className="dg-brand-logo"><ClubCrest /></span>
            <span className="dg-brand-txt">
              <span className="dg-brand-line"><strong>DARICA GÜCÜ</strong><em className="dg-sk">SK 2024</em><em className="dg-sk-m">SK</em></span>
              <small className="dg-sub-d">Otomatik ASKF Fikstür &amp; Paylaşım Stüdyosu</small>
              <small className="dg-sub-m">ASKF Fikstür &amp; Maç Bülteni</small>
            </span>
          </button>
          <nav className="dg-tabs-nav" aria-label="Ana gezinme">
            {navGroups.map((item) => (
              <button key={item.id} type="button" className={group.id === item.id ? 'on' : ''} aria-current={group.id === item.id ? 'page' : undefined} onClick={() => setScreen(item.target)}>
                <Icon name={item.icon} size={16} /><span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="dg-header-right">
            {healthy && <span className="dg-live"><i />ASKF Canlı</span>}
            <button type="button" className="dg-refresh" onClick={() => void refreshData()} disabled={refreshing} aria-label="ASKF verisini yenile">
              <Icon name="refresh" size={14} className={refreshing ? 'spin' : ''} /><span>{refreshing ? 'Yenileniyor' : 'ASKF Yenile'}</span>
            </button>
            <NotificationCenter onNavigate={setScreen}/>
          </div>
        </div>
        {group.id === 'agenda' && (
          <nav className="dg-subnav" aria-label="Ajanda bölümleri">
            <div className="dg-subnav-in">
              {subNav.map((item) => (
                <button key={item.id} type="button" className={screen === item.id ? 'on' : ''} aria-current={screen === item.id ? 'page' : undefined} onClick={() => setScreen(item.id)}>
                  {item.label}{item.id === 'changes' && daricaChanges.length > 0 && <b>{daricaChanges.length}</b>}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="dg-main main-content" id="main-content" tabIndex={-1}>
        <h1 className="sr-only">{navigation.find((item) => item.id === screen)?.label}</h1>
        <PwaStatus />

        {screen !== 'dashboard' && screen !== 'changes' && <section className={healthy ? 'source-banner healthy' : 'source-banner'} aria-labelledby="source-heading">
          <div className="source-icon" aria-hidden="true">{healthy ? '✓' : '!'}</div>
          <div className="source-copy"><span className="eyebrow">VERİ KAYNAĞI DURUMU</span><h2 id="source-heading">{stale ? 'Yenileme başarısız — son doğrulanmış program korunuyor' : verified ? 'ASKF programı doğrulandı' : sourceStatus.state === 'running' ? 'ASKF programı kontrol ediliyor' : 'İlk resmî ASKF doğrulaması bekleniyor'}</h2><p>{verified ? `${live.sourceFile ?? sourceStatus.sourceFile ?? 'ASKF Excel'} · ${live.season ?? sourceStatus.sourceSeason ?? ''} · ${allMatches.length} karşılaşma` : 'Doğrulanmış program oluşana kadar örnek maçlar canlı fikstür gibi gösterilmez.'}</p></div>
          <span className={healthy ? 'state-pill healthy' : 'state-pill'}>{stateLabel(sourceStatus.state, stale)}</span>
        </section>}

        {screen === 'dashboard' && <Dashboard metrics={dashboardMetrics} daricaMatches={daricaMatches as FxMatch[]} changes={(live.changes ?? []) as FxChange[]} verified={healthy} checkedAt={live.checkedAt ?? sourceStatus.lastSuccess} sourceWeek={live.sourceWeek ?? sourceStatus.sourceWeek} onNavigate={setScreen}/>}

        {screen === 'matches' && <>
          <section className="next-match-panel">
            <div className="next-match-heading"><span className="eyebrow">DARICA GÜCÜ · SIRADAKİ MAÇ</span><span className="muted-label">Resmî programdan</span></div>
            {nextMatch ? <div className="next-match-content"><div className="next-match-date"><strong>{formatDate(nextMatch.date)}</strong><span>{nextMatch.time}</span></div><div className="next-match-teams"><strong>{nextMatch.home}</strong><span>VS</span><strong>{nextMatch.away}</strong></div><div className="next-match-meta"><span className="category-pill">{groupLabel(nextMatch.group)}</span><span>{titleTr(nextMatch.venue)}</span></div></div> : <div className="next-match-empty">{unavailableText}</div>}
          </section>
          <section className="schedule-panel module-panel">
            <div className="section-heading"><div><span className="eyebrow">KOCAELİ · U11–U19</span><h2>Haftalık maç programı</h2></div><span className="muted-label">{verified ? `${filteredMatches.length} / ${allMatches.length} maç` : 'Kaynak doğrulaması gerekli'}</span></div>
            <div className="filter-toolbar">
              <label>Kulüp<select value={selectedClub} onChange={(event) => setSelectedClub(event.target.value)}><option value="ALL">Tüm kulüpler</option>{trackedClubs.map((club) => <option key={normalizeClubKey(club)} value={club}>{club}</option>)}</select></label>
              <label>Kategori<select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}><option value="ALL">Tüm kategoriler</option>{groups.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Saha<select value={selectedVenue} onChange={(event) => setSelectedVenue(event.target.value)}><option value="ALL">Tüm sahalar</option>{venues.map((venue) => <option key={venue}>{venue}</option>)}</select></label>
              <label className="search-filter">Ara<input value={matchSearch} onChange={(event) => setMatchSearch(event.target.value)} placeholder="Kulüp, saha, kategori" /></label>
            </div>
            {filteredMatches.length > 0 ? <div className="dg-fxm-list dg-fxm-grid">{filteredMatches.map((match) => <FixtureCard key={match.id} match={match as FxMatch} change={critical.get(match.id)} highlight={match.id === nextMatch?.id} approved={healthy} variant="m" onStudio={goStudio} onShare={share} />)}</div> : <div className="empty-state"><div className="empty-symbol">—</div><h3>{verified ? 'Bu filtrelerde maç bulunamadı' : loadError ? 'Maç verisi şu anda alınamıyor' : 'Doğrulanmış maç verisi henüz yok'}</h3><p>{verified ? 'Filtreleri genişlet veya farklı bir kulüp, kategori ya da saha seç.' : 'ASKF kaynağı başarıyla taranıp Excel dosyası doğrulandığında karşılaşmalar burada listelenecek.'}</p><span className="empty-note">Programda maç görünmemesi, sahanın kesin olarak boş olduğu anlamına gelmez.</span></div>}
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
            <div className="management-list">{filteredVenues.map((venue) => <div className="management-row" key={venue}><div><strong>{venue}</strong><span>{matchesForVenue(allMatches, venue).length} listelenen karşılaşma · Boş olduğu anlamına gelmez</span></div><div className="dg-row-actions"><a className="quiet-button dg-link-btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${titleTr(venue)}, Kocaeli`)}`} target="_blank" rel="noopener noreferrer">Harita</a><button className={trackedVenues.includes(venue) ? 'quiet-button selected' : 'quiet-button'} type="button" onClick={() => trackedVenues.includes(venue) ? setTrackedVenues((current) => current.filter((item) => item !== venue)) : addVenue(venue)}>{trackedVenues.includes(venue) ? 'Takipte' : 'Sahayı takip et'}</button></div></div>)}</div>
            {trackedVenues.length > 0 && <p className="quiet-note">Takip edilen sahalar: {trackedVenues.join(' · ')}</p>}
            {venues.length === 0 && <div className="empty-state"><h3>Henüz doğrulanmış saha kataloğu yok</h3><p>ASKF programı doğrulandığında sahalar otomatik listelenecek.</p></div>}
          </div>
        </section>}

        {screen === 'changes' && <div className="dg-changes">
          {verified && <ChangeBand changes={daricaChanges} daricaMatches={daricaMatches as FxMatch[]} checkedAt={live.checkedAt ?? sourceStatus.lastSuccess} sourceWeek={live.sourceWeek ?? sourceStatus.sourceWeek} now={new Date()} onShare={share} onToast={show} />}
          <section className="module-panel">
            <div className="section-heading"><div><span className="eyebrow">PROGRAM KARŞILAŞTIRMASI</span><h2>Değişiklik merkezi</h2></div><span className="muted-label">{live.changes?.length ?? 0} olay</span></div>
            <div className="module-content">{!verified ? <div className="empty-state"><h3>Değişiklik geçmişi bekleniyor</h3><p>İki doğrulanmış ASKF programı karşılaştırılmadan değişiklik ilan edilmez.</p></div> : live.changes?.length ? <div className="dg-change-list">{(live.changes as FxChange[]).map((change, index) => {
              const m = change.current ?? change.previous ?? {};
              const rows = diffRows(change);
              const verifyOnly = isVerificationOnly(change);
              return <article className={verifyOnly ? 'dg-change-card verify' : 'dg-change-card'} key={`${change.fixtureId}-${change.type}-${index}`}>
                <div className="dg-change-top"><span className="dg-pill gold">{groupLabel(m.group)}</span><strong>{changeLabel(change.type)}</strong></div>
                <p className="dg-change-match">{titleTr(m.home ?? 'Takım')} – {titleTr(m.away ?? 'Takım')}</p>
                {verifyOnly ? <p className="dg-change-verify">İPTAL DEĞİL · DOĞRULAMA GEREKLİ</p> : rows.length ? <div className="dg-band-rows">{rows.map((r) => <div className="dg-band-row" key={r.key}><span className="dg-band-label"><Icon name={r.icon} size={14} />{r.label}</span><span className="dg-band-vals"><s>{r.from}</s><b className="arrow">➔</b><b className={r.icon === 'pin' ? 'new green' : 'new'}>{r.to}</b></span></div>)}</div> : <p className="dg-change-verify plain">{m.date ? `${formatDate(m.date)} · ${m.time ?? ''}` : 'Kaynak değişikliği'}</p>}
                {!verifyOnly && changeTouchesDarica(change) && <div className="dg-change-actions"><button type="button" className="dg-btn-emerald" onClick={() => void share(changeShareText([change]), 'Program Değişikliği')}><Icon name="message" size={14} />Veli grubuna bildir</button></div>}
              </article>;
            })}</div> : <div className="empty-state"><h3>Yeni değişiklik yok</h3><p>Son doğrulanmış program ile önceki program arasında kayıtlı değişiklik bulunmuyor.</p></div>}</div>
          </section>
        </div>}

        {screen === 'posters' && <PosterStudio fixtures={posterFixtures} verified={healthy}/>}

        {screen === 'source' && <AskfReviewPanel onApproved={() => window.location.reload()} />}

        <footer className="app-footer"><span>DARICA GÜCÜ · V4 PRO</span><span>KOCAELİ ASKF · DOĞRULANMIŞ PROGRAM</span></footer>
      </main>

      <nav className="dg-bottom-nav" aria-label="Mobil gezinme">
        {navGroups.map((item) => (
          <button key={item.id} type="button" className={group.id === item.id ? 'on' : ''} aria-current={group.id === item.id ? 'page' : undefined} onClick={() => setScreen(item.target)}>
            <Icon name={item.icon} size={22} /><span>{item.short}</span>
          </button>
        ))}
      </nav>
      {screen !== 'dashboard' && toast}
    </div>
  );
}

export default App;
