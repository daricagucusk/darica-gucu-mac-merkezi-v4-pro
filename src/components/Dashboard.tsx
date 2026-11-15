import { useEffect, useMemo, useState } from 'react';
import type { DashboardMetrics } from '../dashboard/metrics';
import { countdownTo, kickoffToEpoch, type Countdown } from '../media/countdown';
import CalendarMenu from './CalendarMenu';
import ChangeBand from './ChangeBand';
import ClubCrest from './ClubCrest';
import FixtureCard from './FixtureCard';
import Icon from './icons';
import SponsorTicker from './SponsorTicker';
import { useToast } from './Toast';
import {
  changeShareText, changeTouchesDarica, filterByTab, groupLabel, isCritical, isDarica, longDate, mapsUrl, matchShareText,
  shareText, side, titleTr,
  type FxChange, type FxMatch, type TabId,
} from './fixture-utils';

type Props = {
  metrics: DashboardMetrics;
  daricaMatches: FxMatch[];
  changes: FxChange[];
  verified: boolean;
  checkedAt?: string | null;
  sourceWeek?: number;
  onNavigate: (screen: 'matches' | 'changes' | 'posters' | 'source') => void;
};

type Weather = { temperatureC: number; label: string; source: string };

function useWeather(match: FxMatch | null): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  const id = match?.id;
  useEffect(() => {
    setWeather(null);
    if (!match) return;
    const epoch = kickoffToEpoch({ date: match.date, time: match.time });
    if (epoch === null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/weather?at=${encodeURIComponent(new Date(epoch).toISOString())}`, { signal: controller.signal });
        if (!response.ok) return;
        const body = (await response.json()) as { available?: boolean; temperatureC?: number; label?: string; source?: string } | null;
        if (body && body.available === true && typeof body.temperatureC === 'number' && typeof body.label === 'string') {
          setWeather({ temperatureC: body.temperatureC, label: body.label, source: body.source ?? 'Open-Meteo' });
        }
      } catch { /* hava kartı yalnızca gerçek veriyle gösterilir */ }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return weather;
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const pad = (n: number) => String(n).padStart(2, '0');
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'upcoming', label: 'Yaklaşan' },
  { id: 'week', label: 'Bu Hafta' },
  { id: 'past', label: 'Sonuçlar' },
];
const EMPTY: Record<TabId, string> = {
  upcoming: 'Doğrulanmış programda yaklaşan Darıca Gücü maçı görünmüyor.',
  week: 'Bu hafta için programda Darıca Gücü maçı görünmüyor.',
  past: 'Programda oynanmış Darıca Gücü maçı listelenmiyor. Skorlar bu ekranda tutulmaz.',
};

function CountdownDigits({ cd, compact }: { cd: Countdown; compact?: boolean }) {
  const cells: Array<[string, string, string]> = [
    [pad(cd.days), 'GÜN', ''], [pad(cd.hours), 'SAAT', 'bright'], [pad(cd.minutes), compact ? 'DAKİKA' : 'DAKİKA', ''], [pad(cd.seconds), 'SANİYE', 'gold'],
  ];
  const used = compact ? cells.slice(0, 3) : cells;
  return (
    <div className={compact ? 'dg-cd compact' : 'dg-cd'} role="timer" aria-label="Maça kalan süre">
      {used.map(([value, label, tone], index) => (
        <div className={`dg-cd-cell ${compact && index === 2 ? 'bright' : tone}`} key={label}>
          <strong>{value}</strong><span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ metrics, daricaMatches, changes, verified, checkedAt, sourceWeek, onNavigate }: Props) {
  const now = useNow();
  const { toast, show } = useToast();
  const [tab, setTab] = useState<TabId>('upcoming');
  const [facilityOpen, setFacilityOpen] = useState(true);
  const featured = (metrics.nextMatch as FxMatch | null) ?? null;
  const weather = useWeather(featured);
  const cd = featured ? countdownTo({ date: featured.date, time: featured.time }, now) : null;
  const darica = useMemo(() => changes.filter(changeTouchesDarica), [changes]);
  const list = useMemo(() => filterByTab(daricaMatches, tab, now).slice(0, 12), [daricaMatches, tab, now]);
  const criticalByMatch = useMemo(() => {
    const map = new Map<string, FxChange>();
    for (const change of darica) if (isCritical(change)) map.set(change.current?.id ?? change.fixtureId, change);
    return map;
  }, [darica]);
  const facilityMatch = featured ?? list[0] ?? null;
  const facilityCount = facilityMatch ? daricaMatches.filter((m) => m.venue === facilityMatch.venue).length : 0;

  const share = async (text: string, title: string) => show(await shareText(text, title));
  const studio = () => onNavigate('posters');
  const toMap = () => document.getElementById('dg-facility')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const notify = (change: FxChange) => void share(changeShareText([change]), 'Program Değişikliği');
  const fSide = featured ? side(featured) : null;
  const ownIsHome = fSide === 'home';

  const heroHeader = featured && (
    <>
      <span className="dg-live-pill"><i />SIRADAKİ {`RESMİ `}MAÇ</span>
      <span className="dg-grey-pill">{groupLabel(featured.group)}{sourceWeek ? ` • ${sourceWeek}. Hafta` : ''}</span>
      {verified && <span className="dg-gold-pill">ASKF Onaylı</span>}
    </>
  );

  return (
    <div className="dg-dash">
      <SponsorTicker />
      <ChangeBand changes={darica} daricaMatches={daricaMatches} checkedAt={checkedAt} sourceWeek={sourceWeek} now={now} onShare={share} onToast={show} onOpenAll={() => onNavigate('changes')} />

      {featured ? (
        <>
          <section className="dg-hero dg-only-d" aria-label="Sıradaki maç">
            <div className="dg-hero-wm" aria-hidden="true"><ClubCrest /></div>
            <div className={cd || weather ? 'dg-hero-grid has-side' : 'dg-hero-grid'}>
              <div className="dg-hero-main">
                <div className="dg-hero-pills">{heroHeader}</div>
                <div className="dg-hero-teams">
                  <div><p className={ownIsHome ? 'dg-lbl green' : 'dg-lbl'}>Ev Sahibi</p><h3 className={ownIsHome ? 'own' : ''}>{featured.home}</h3></div>
                  <span className="dg-vs">VS</span>
                  <div><p className={fSide === 'away' ? 'dg-lbl green' : 'dg-lbl'}>Deplasman</p><h3 className={fSide === 'away' ? 'own' : ''}>{featured.away}</h3></div>
                </div>
                <div className="dg-hero-meta">
                  <span><Icon name="calendar" size={16} className="green" /><b>{longDate(featured.date)}</b></span>
                  <span><Icon name="clock" size={16} className="gold" /><b className="gold">{featured.time}</b></span>
                  <span><Icon name="pin" size={16} className="green" />{titleTr(featured.venue)}</span>
                </div>
                <div className="dg-hero-actions">
                  <a className="dg-btn-outline" href={mapsUrl(featured.venue)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={14} />Sahayı Haritada Aç</a>
                  <CalendarMenu match={featured} onToast={show} className="dg-btn-bright" label="Takvime Ekle" />
                  <button type="button" className="dg-btn-dark" onClick={studio}><Icon name="sparkles" size={14} className="gold" />Maç Günü Afişi</button>
                  <button type="button" className="dg-btn-wa" onClick={() => void share(matchShareText(featured), 'Maç Bülteni')}><Icon name="message" size={14} />WhatsApp'ta Paylaş</button>
                </div>
              </div>
              {(cd || weather) && (
                <div className="dg-hero-side">
                  {cd && <><span className="dg-side-title">BAŞLAMAYA KALAN SÜRE</span><CountdownDigits cd={cd} /></>}
                  {weather && (
                    <div className="dg-weather">
                      <span><Icon name="cloud" size={14} className="gold" />{Math.round(weather.temperatureC)}°C • {weather.label}</span>
                      <small>Kaynak: {weather.source}</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="dg-hm dg-only-m" aria-label="Sıradaki maç">
            <div className="dg-hm-top">
              <span className="dg-hm-badge"><i />SIRADAKİ MAÇ</span>
              <span className="dg-hm-group"><Icon name="clock" size={14} className="green" />{groupLabel(featured.group)}</span>
            </div>
            <div className="dg-hm-teams">
              <div className="dg-hm-team">
                <span className={isDarica(featured.home) ? 'dg-hm-logo crest' : 'dg-hm-logo'}>{isDarica(featured.home) ? <ClubCrest /> : <Icon name="ball" size={32} />}</span>
                <strong className={isDarica(featured.home) ? 'own' : ''}>{isDarica(featured.home) ? 'Darıca Gücü' : titleTr(featured.home)}</strong>
                <em>Ev Sahibi</em>
              </div>
              <div className="dg-hm-vs"><b>VS</b><span>{featured.time}</span></div>
              <div className="dg-hm-team">
                <span className={isDarica(featured.away) ? 'dg-hm-logo crest' : 'dg-hm-logo'}>{isDarica(featured.away) ? <ClubCrest /> : <Icon name="ball" size={32} />}</span>
                <strong className={isDarica(featured.away) ? 'own' : ''}>{isDarica(featured.away) ? 'Darıca Gücü' : titleTr(featured.away)}</strong>
                <em>Deplasman</em>
              </div>
            </div>
            {cd && (
              <div className="dg-hm-cd">
                <span>Kalan Zaman</span>
                <CountdownDigits cd={cd} compact />
              </div>
            )}
            {weather && <div className="dg-weather m"><span><Icon name="cloud" size={14} className="gold" />{Math.round(weather.temperatureC)}°C • {weather.label}</span><small>Kaynak: {weather.source}</small></div>}
            <div className="dg-hm-meta">
              <span><Icon name="pin" size={16} className="green" /><span className="dg-trunc">{titleTr(featured.venue)}</span></span>
              <span className="dg-hm-day"><Icon name="calendar" size={14} className="soft" />{new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(`${featured.date}T12:00:00+03:00`))}</span>
            </div>
            <div className="dg-hm-actions">
              <button type="button" className="map" onClick={toMap}><Icon name="navigation" size={16} />Harita</button>
              <CalendarMenu match={featured} onToast={show} className="cal" label="Takvim" />
              <button type="button" onClick={() => void share(matchShareText(featured), 'Maç Bülteni')}><Icon name="share" size={16} className="green" />Bülten</button>
            </div>
          </section>
        </>
      ) : (
        <section className="dg-hero dg-empty-hero" aria-label="Sıradaki maç">
          <Icon name="clock" size={28} className="green" />
          <strong>{verified ? 'Yaklaşan maç bulunamadı' : 'Program doğrulaması bekleniyor'}</strong>
          <p>{verified ? 'Mevcut doğrulanmış program aralığında yaklaşan Darıca Gücü maçı görünmüyor.' : 'Resmî ASKF programı doğrulandığında sıradaki karşılaşma burada gösterilecek.'}</p>
        </section>
      )}

      <section className="dg-list-section" aria-labelledby="dg-list-title">
        <div className="dg-list-head">
          <div>
            <div className="dg-list-title"><h2 id="dg-list-title">HAFTALIK RESMİ MAÇ PROGRAMI</h2><span className="dg-count">{list.length} Maç Listelendi</span></div>
            <p>Kocaeli ASKF Resmî Fikstür Matrisinden Darıca Gücü SK maçları otomatik filtrelenmiştir.</p>
          </div>
          <button type="button" className="dg-btn-solid" onClick={studio}><Icon name="layout" size={16} />Paylaşım Stüdyosuna Aktar</button>
        </div>
        <div className="dg-tabs" role="tablist" aria-label="Maç listesi">
          {TABS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
          ))}
        </div>
        {list.length ? (
          <>
            <div className="dg-fxd-grid dg-only-d">
              {list.map((match) => <FixtureCard key={match.id} match={match} change={criticalByMatch.get(match.id)} approved={verified} variant="d" onStudio={studio} onShare={share} onNotify={notify} />)}
            </div>
            <div className="dg-fxm-list dg-only-m">
              {list.map((match) => <FixtureCard key={match.id} match={match} change={criticalByMatch.get(match.id)} highlight={match.id === featured?.id} approved={verified} variant="m" onStudio={studio} onShare={share} />)}
            </div>
          </>
        ) : <p className="dg-list-empty">{EMPTY[tab]}</p>}
      </section>

      {facilityMatch && (
        <section className="dg-facility" id="dg-facility" aria-label="Tesis ve maç koordinasyonu">
          <button type="button" className="dg-facility-head" aria-expanded={facilityOpen} onClick={() => setFacilityOpen((v) => !v)}>
            <span className="dg-facility-ic"><Icon name="pin" size={20} /></span>
            <span className="dg-facility-txt"><strong>Tesis &amp; Maç Koordinasyonu</strong><small>{titleTr(facilityMatch.venue)} · {facilityCount} listelenen karşılaşma</small></span>
            <Icon name="chevron" size={20} className={facilityOpen ? 'dg-chev open' : 'dg-chev'} />
          </button>
          {(
            <div className={facilityOpen ? 'dg-facility-body' : 'dg-facility-body closed'}>
              <div className="dg-facility-map">
                <span className="dg-facility-chip"><Icon name="pin" size={16} className="green" /><span className="dg-trunc">{titleTr(facilityMatch.venue)}</span></span>
                <a href={mapsUrl(facilityMatch.venue)} target="_blank" rel="noopener noreferrer"><span className="dg-nav-m">Navigasyon</span><span className="dg-nav-d">Yol Tarifi Al</span> <Icon name="external" size={13} /></a>
              </div>
              <div className="dg-facility-note dg-only-m">
                <Icon name="share" size={20} className="green" />
                <div><strong>Otomatik ASKF Fikstür &amp; Tek Tık Paylaşım</strong><p>Haftalık maç programı ASKF sisteminden otomatik senkronize edilir; maç bülteni tek tıkla WhatsApp veli gruplarına ve sosyal medyaya aktarılabilir.</p></div>
              </div>
              <div className="dg-facility-grid dg-only-m">
                <div><Icon name="refresh" size={18} className="green" /><span><small>ASKF Senkronizasyon</small><b className={verified ? 'green' : 'gold'}>{verified ? 'Otomatik • Güncel' : 'Doğrulama bekleniyor'}</b></span></div>
                <button type="button" onClick={studio}><Icon name="share" size={18} className="soft" /><span><small>Paylaşım Stüdyosu</small><b>WhatsApp &amp; Sosyal</b></span></button>
              </div>
            </div>
          )}
        </section>
      )}
      <p className="dg-foot-note">Maç sayıları yalnızca doğrulanmış KASKF programından hesaplanır. Programda görünmeyen maç iptal olarak yorumlanmaz.</p>
      {toast}
    </div>
  );
}
