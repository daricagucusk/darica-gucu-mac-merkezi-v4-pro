import { getSponsors, instagramUrl, type Sponsor } from '../media/sponsors';

/** Logo rozeti: açık zeminli kutu (koyu lacivert/siyah logolar koyu bantta okunsun). Logo yoksa hiçbir şey çizilmez. */
export function SponsorLogo({ sponsor, className = 'dg-sp-logo' }: { sponsor: Sponsor; className?: string }) {
  if (!sponsor.logo) return null;
  return <span className={className}><img src={sponsor.logo} alt="" loading="lazy" decoding="async" /></span>;
}

/** Kayan sponsor bandı (Stitch sponsor_marquee_hava): logo + ad + Instagram hesabı; hesabı olan öğe Instagram'a bağlanır. */
export default function SponsorTicker() {
  const sponsors = getSponsors();
  if (!sponsors.length) return null;
  const track = (hidden: boolean) => (
    <div className="dg-ticker-track" aria-hidden={hidden || undefined}>
      {sponsors.map((s) => {
        const href = instagramUrl(s);
        const inner = (
          <>
            <SponsorLogo sponsor={s} />
            <b>{s.shortName}</b>
            {s.instagram ? <small className="handle">{s.instagram}</small> : s.role ? <small className="role">{s.role}</small> : null}
          </>
        );
        return (
          <span className="dg-ticker-item" key={s.id}>
            {href
              ? <a className="dg-ticker-sp" href={href} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} aria-label={`${s.name} Instagram hesabı ${s.instagram}`}>{inner}</a>
              : <span className="dg-ticker-sp">{inner}</span>}
            <i className="dg-ticker-dot">●</i>
          </span>
        );
      })}
    </div>
  );
  return (
    <div className="dg-ticker" role="group" aria-label="Sponsorlar">
      <div className="dg-ticker-run">{track(false)}{track(true)}</div>
    </div>
  );
}
