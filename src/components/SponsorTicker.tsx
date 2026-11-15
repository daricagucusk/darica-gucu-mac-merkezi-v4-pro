import { getSponsors } from '../media/sponsors';

const TONES = ['gold', 'bright', 'emerald', 'amber', 'cyan', 'gold'];

/** Kayan sponsor bandı (Stitch sponsor_marquee_hava). Liste src/media/sponsors.ts kaynağından gelir. */
export default function SponsorTicker() {
  const sponsors = getSponsors();
  if (!sponsors.length) return null;
  const track = (hidden: boolean) => (
    <div className="dg-ticker-track" aria-hidden={hidden || undefined}>
      {sponsors.map((s, i) => (
        <span className="dg-ticker-item" key={s.name}>
          <span className={`dg-ticker-sp tone-${TONES[i % TONES.length]}`}><b>{s.name}</b><small>{s.role}</small></span>
          <i className="dg-ticker-dot">●</i>
        </span>
      ))}
    </div>
  );
  return (
    <div className="dg-ticker" role="group" aria-label="Sponsorlar">
      <div className="dg-ticker-run">{track(false)}{track(true)}</div>
    </div>
  );
}
