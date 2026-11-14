import MetricCard from './MetricCard';
import type { DashboardMetrics, DashboardMatch } from '../dashboard/metrics';

type DashboardChange = {
  fixtureId: string;
  type: string;
  status?: string;
  current?: Partial<DashboardMatch>;
  previous?: Partial<DashboardMatch>;
};

type Props = {
  metrics: DashboardMetrics;
  matches: DashboardMatch[];
  changes: DashboardChange[];
  verified: boolean;
  lastUpdated?: string | null;
  onNavigate: (screen: 'matches' | 'changes' | 'posters' | 'source') => void;
};

function shortDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00+03:00`);
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', timeZone: 'Europe/Istanbul' }).format(parsed);
}

function changeLabel(type: string): string {
  switch (type) {
    case 'added': return 'Yeni maç eklendi';
    case 'kickoff_changed': return 'Tarih / saat güncellendi';
    case 'venue_changed': return 'Saha bilgisi güncellendi';
    case 'teams_changed': return 'Takım bilgisi değişti';
    case 'missing': return 'Programda görünmüyor · doğrulama gerekli';
    default: return 'Program değişikliği';
  }
}

export default function Dashboard({ metrics, matches, changes, verified, lastUpdated, onNavigate }: Props) {
  const maxCategory = Math.max(1, ...metrics.categoryCounts.map((item) => item.count));
  const featured = metrics.nextMatch;
  const recent = changes.slice(0, 4);

  return (
    <div className="dashboard-page page-enter">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">DARICA GÜCÜ · KULÜP OPERASYON MERKEZİ</span>
          <h2>Takımın ritmi.<br/><span>Tek merkezden.</span></h2>
          <p>Haftalık fikstür, takip edilen kulüpler, saha bilgileri ve paylaşım araçları tek ekranda.</p>
          <div className="dashboard-hero-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate('matches')}>Maç programını aç <span aria-hidden="true">↗</span></button>
            <button type="button" className="glass-button" onClick={() => onNavigate('posters')}>Afiş hazırla</button>
          </div>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <div className="pitch-orbit orbit-one" />
          <div className="pitch-orbit orbit-two" />
          <div className="pitch-circle" />
          <div className="pitch-mark pitch-mark-a" />
          <div className="pitch-mark pitch-mark-b" />
          <div className="pitch-spark spark-one" />
          <div className="pitch-spark spark-two" />
          <div className="dashboard-hero-monogram">DG</div>
        </div>
        <div className="dashboard-hero-footer">
          <span className={verified ? 'live-indicator active' : 'live-indicator'} />
          <span>{verified ? 'ASKF programı doğrulanmış' : 'Resmî program doğrulaması bekleniyor'}</span>
          <span className="hero-updated">{lastUpdated ? `Son güncelleme · ${lastUpdated}` : 'Kaynak saati bekleniyor'}</span>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div><span className="eyebrow">GENEL BAKIŞ</span><h3>Operasyon özeti</h3></div>
          <span className={metrics.sourceLabel === 'GÜNCEL' ? 'freshness-pill fresh' : 'freshness-pill'}>{metrics.sourceLabel}</span>
        </div>
        <div className="metric-grid">
          <MetricCard label="Toplam fikstür" value={metrics.fixtureCount} detail="Kaynak programındaki maçlar" tone="emerald" icon="▦"/>
          <MetricCard label="Darıca Gücü" value={metrics.daricaFixtureCount} detail="Kulübün programdaki maçları" tone="cyan" icon="◉"/>
          <MetricCard label="Yaklaşan maç" value={metrics.upcomingCount} detail="Oynanmamış, programdaki maçlar" tone="amber" icon="◷"/>
          <MetricCard label="Takip edilen kulüp" value={metrics.trackedClubCount} detail="Kişisel takip listen" tone="violet" icon="◎"/>
          <MetricCard label="Program değişikliği" value={metrics.changeCount} detail="Son karşılaştırmada bulunan kayıtlar" tone="coral" icon="↗"/>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <article className="next-fixture-card glass-card">
          <div className="panel-heading">
            <div><span className="eyebrow">SIRADAKİ KARŞILAŞMA</span><h3>Maç günü</h3></div>
            <span className="panel-icon">⚽</span>
          </div>
          {featured ? (
            <>
              <div className="fixture-date-block">
                <span>{shortDate(featured.date)}</span>
                <strong>{featured.time}</strong>
              </div>
              <div className="fixture-versus">
                <div className="fixture-team"><span className="team-crest">DG</span><strong>{featured.home}</strong></div>
                <span className="versus-mark">VS</span>
                <div className="fixture-team away"><span className="team-crest opponent">OP</span><strong>{featured.away}</strong></div>
              </div>
              <div className="fixture-meta-row">
                <span className="fixture-tag">{featured.group}</span>
                <span className="fixture-venue">⌖ {featured.venue}</span>
              </div>
              <button className="fixture-open-link" type="button" onClick={() => onNavigate('matches')}>Fikstürde görüntüle <span>→</span></button>
            </>
          ) : (
            <div className="dashboard-empty">
              <span className="empty-icon">◷</span>
              <strong>{verified ? 'Yaklaşan maç bulunamadı' : 'Program doğrulaması bekleniyor'}</strong>
              <p>{verified ? 'Mevcut doğrulanmış program aralığında yaklaşan Darıca Gücü maçı görünmüyor.' : 'Resmî ASKF programı doğrulandığında sıradaki karşılaşma burada gösterilecek.'}</p>
            </div>
          )}
        </article>

        <article className="category-card glass-card">
          <div className="panel-heading">
            <div><span className="eyebrow">YAŞ KATEGORİLERİ</span><h3>Program dağılımı</h3></div>
            <span className="panel-icon">▤</span>
          </div>
          {metrics.categoryCounts.length ? (
            <div className="category-bars">
              {metrics.categoryCounts.map((item, index) => (
                <div className="category-bar-row" key={item.category}>
                  <div className="category-bar-label"><strong>{item.category}</strong><span>{item.count} maç</span></div>
                  <div className="category-track"><span className={`category-fill category-fill-${index % 5}`} style={{ width: `${Math.max(7, (item.count / maxCategory) * 100)}%` }}/></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty compact"><strong>Henüz kategori verisi yok</strong><p>Doğrulanmış fikstür geldiğinde otomatik oluşturulur.</p></div>
          )}
          <button className="text-action" type="button" onClick={() => onNavigate('matches')}>Tüm karşılaşmaları gör →</button>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="activity-card glass-card">
          <div className="panel-heading">
            <div><span className="eyebrow">SON HAREKETLER</span><h3>Program gündemi</h3></div>
            <button type="button" className="subtle-link" onClick={() => onNavigate('changes')}>Tümünü gör</button>
          </div>
          {recent.length ? (
            <div className="activity-list">
              {recent.map((change, index) => {
                const match = change.current ?? change.previous;
                return (
                  <div className="activity-item" key={`${change.fixtureId}-${change.type}-${index}`}>
                    <span className={`activity-dot activity-dot-${index % 4}`}/>
                    <div><strong>{changeLabel(change.type)}</strong><span>{match ? `${match.home ?? 'Takım'} – ${match.away ?? 'Takım'} · ${match.group ?? ''}` : change.fixtureId}</span></div>
                    <span className="activity-arrow">↗</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="activity-empty"><span>✓</span><div><strong>Yeni değişiklik kaydı yok</strong><p>Son program karşılaştırmasında listelenecek yeni bir hareket bulunmadı.</p></div></div>
          )}
        </article>

        <article className="quick-actions-card glass-card">
          <div className="panel-heading"><div><span className="eyebrow">HIZLI ERİŞİM</span><h3>İşlem başlat</h3></div></div>
          <button className="quick-action" type="button" onClick={() => onNavigate('posters')}><span className="quick-action-icon poster-icon">✦</span><span><strong>Afiş Stüdyosu</strong><small>Sosyal medya görseli üret</small></span><b>→</b></button>
          <button className="quick-action" type="button" onClick={() => onNavigate('source')}><span className="quick-action-icon source-icon">⇅</span><span><strong>ASKF programı</strong><small>Yeni dosyayı incele ve onayla</small></span><b>→</b></button>
          <button className="quick-action" type="button" onClick={() => onNavigate('changes')}><span className="quick-action-icon change-icon">⌁</span><span><strong>Değişiklik merkezi</strong><small>Fikstür karşılaştırmasını görüntüle</small></span><b>→</b></button>
        </article>
      </section>
      <p className="dashboard-footnote">Fikstür ve karşılaşma sayıları yalnızca doğrulanmış KASKF programından hesaplanır. Eksik görünen maçlar iptal olarak yorumlanmaz.</p>
    </div>
  );
}
