import { getSponsors, instagramUrl } from '../media/sponsors';
import { SponsorLogo } from './SponsorTicker';

/** "Sponsorlarımız" kartı (Stitch kulüp sponsoru kartı dili): logo kartları + Instagram'da takip et. */
export default function SponsorCards() {
  const sponsors = getSponsors();
  if (!sponsors.length) return null;
  return (
    <section className="dg-spc" aria-labelledby="dg-spc-title">
      <div className="dg-spc-head">
        <span className="dg-spc-ic" aria-hidden="true">★</span>
        <div>
          <h2 id="dg-spc-title">SPONSORLARIMIZ</h2>
          <p>Kulübümüze destek olan resmî sponsorlar</p>
        </div>
      </div>
      <div className="dg-spc-grid">
        {sponsors.map((s) => {
          const href = instagramUrl(s);
          return (
            <article className="dg-spc-card" key={s.id}>
              <div className="dg-spc-mark">
                {s.logo ? <SponsorLogo sponsor={s} className="dg-spc-logo" /> : <span className="dg-spc-word">{s.shortName}</span>}
              </div>
              <div className="dg-spc-body">
                <strong>{s.name}</strong>
                <small>{[s.role, s.city].filter(Boolean).join(' · ') || ' '}</small>
              </div>
              {href && <a className="dg-spc-btn" href={href} target="_blank" rel="noopener noreferrer">Instagram&apos;da takip et <span>{s.instagram}</span></a>}
              {s.url && <a className="dg-spc-web" href={s.url} target="_blank" rel="noopener noreferrer">{s.url.replace(/^https?:\/\//, '')}</a>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
