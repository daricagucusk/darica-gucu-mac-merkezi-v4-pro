import Icon from './icons';
import ClubCrest from './ClubCrest';
import {
  diffRows, groupLabel, isDarica, longDate, mapsUrl, matchShareText, shortDate, side, titleTr,
  type FxChange, type FxMatch,
} from './fixture-utils';

type Props = {
  match: FxMatch;
  change?: FxChange;
  highlight?: boolean;
  approved: boolean;
  variant: 'd' | 'm';
  onStudio: () => void;
  onShare: (text: string, title: string) => void;
  onNotify?: (change: FxChange) => void;
};

const STATUS: Record<FxMatch['status'], string> = { scheduled: '', postponed: 'ERTELENDİ', cancelled: 'İPTAL' };

function changedLabel(change: FxChange | undefined): string | null {
  if (!change || change.type === 'missing' || change.type === 'added') return null;
  const keys = diffRows(change).map((row) => row.key);
  const parts = [
    keys.includes('t') || keys.includes('d') ? 'SAAT' : '',
    keys.includes('v') ? 'SAHA' : '',
    keys.includes('g') || keys.includes('k') ? 'TAKIM' : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(' VE ')} DEĞİŞTİ` : 'PROGRAM DEĞİŞTİ';
}

function TeamName({ name, own }: { name: string; own: boolean }) {
  return <span className={own ? 'dg-team own' : 'dg-team'}>{own ? name : titleTr(name)}</span>;
}

function Logo({ own }: { own: boolean }) {
  return own
    ? <span className="dg-fxm-logo crest"><ClubCrest /></span>
    : <span className="dg-fxm-logo"><Icon name="ball" size={18} /></span>;
}

export default function FixtureCard({ match, change, highlight, approved, variant, onStudio, onShare, onNotify }: Props) {
  const s = side(match);
  const label = changedLabel(change);
  const rows = change ? diffRows(change) : [];
  const timeRow = rows.find((row) => row.key === 't');
  const venueRow = rows.find((row) => row.key === 'v');
  const stateText = STATUS[match.status];
  const share = () => onShare(matchShareText(match), 'Maç Bülteni');

  if (variant === 'd') {
    return (
      <article className={label ? 'dg-fxd changed' : 'dg-fxd'}>
        <div className="dg-fxd-top">
          <span className={label ? 'dg-pill gold' : 'dg-pill green'}>{groupLabel(match.group)}</span>
          {label ? <span className="dg-chip gold-solid"><Icon name="alert" size={12} />{label}</span>
            : stateText ? <span className="dg-chip gold">{stateText}</span>
            : approved ? <span className="dg-chip green"><Icon name="check" size={12} />ASKF ONAYLI</span> : null}
        </div>
        <div className="dg-fxd-teams">
          <div><TeamName name={match.home} own={isDarica(match.home)} />{s && <em className={s === 'home' ? 'dg-tag on' : 'dg-tag'}>EV</em>}</div>
          <div><TeamName name={match.away} own={isDarica(match.away)} />{s && <em className={s === 'away' ? 'dg-tag on' : 'dg-tag'}>DEP</em>}</div>
        </div>
        <div className="dg-fxd-meta">
          <span><Icon name="calendar" size={14} />{longDate(match.date)}</span>
          <span className="gold"><Icon name="clock" size={14} />{timeRow ? <><s>{timeRow.from}</s><b className="dg-new">{timeRow.to}</b></> : <b>{match.time}</b>}</span>
          <span className={venueRow ? 'strong' : ''}><Icon name="pin" size={14} /><span className="dg-trunc">{titleTr(match.venue)}</span></span>
        </div>
        <div className="dg-fxd-actions">
          {label && change && onNotify ? (
            <>
              <button type="button" className="dg-btn-gold" onClick={onStudio}><Icon name="sparkles" size={13} />Revize Afiş</button>
              <button type="button" className="dg-btn-emerald" onClick={() => onNotify(change)}><Icon name="message" size={13} />Acil Duyur</button>
            </>
          ) : (
            <>
              <button type="button" className="dg-btn-dark" onClick={onStudio}><Icon name="sparkles" size={13} className="gold" />Stüdyo</button>
              <a className="dg-btn-dark" href={mapsUrl(match.venue)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={13} className="gold" />Harita</a>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={label ? 'dg-fxm changed' : 'dg-fxm'}>
      <div className="dg-fxm-top">
        <div className="dg-fxm-top-l">
          <span className={highlight ? 'dg-fxm-group hi' : 'dg-fxm-group'}>{groupLabel(match.group)}</span>
          <span className="dg-fxm-date"><Icon name="calendar" size={14} />{shortDate(match.date)}</span>
        </div>
        <span className="dg-fxm-time"><Icon name="clock" size={14} />{timeRow ? <><s>{timeRow.from}</s> {match.time}</> : match.time}</span>
      </div>
      <div className="dg-fxm-row">
        <div className="dg-fxm-side"><Logo own={isDarica(match.home)} /><TeamName name={match.home} own={isDarica(match.home)} /></div>
        <span className="dg-fxm-vs">VS</span>
        <div className="dg-fxm-side end"><TeamName name={match.away} own={isDarica(match.away)} /><Logo own={isDarica(match.away)} /></div>
      </div>
      <div className="dg-fxm-loc">
        <span className="dg-fxm-venue"><Icon name="pin" size={15} /><span className="dg-trunc">{titleTr(match.venue)}</span></span>
        {label ? <span className="dg-fxm-tag gold">{label}</span>
          : stateText ? <span className="dg-fxm-tag gold">{stateText}</span>
          : s ? <span className={s === 'home' ? 'dg-fxm-tag home' : 'dg-fxm-tag away'}>{s === 'home' ? 'EV SAHİBİ' : 'DEPLASMAN'}</span> : null}
      </div>
      <div className="dg-fxm-actions">
        <a href={mapsUrl(match.venue)} target="_blank" rel="noopener noreferrer"><Icon name="navigation" size={15} className="green" />Harita</a>
        <button type="button" onClick={share}><Icon name="share" size={15} className="soft" />Paylaş</button>
      </div>
    </article>
  );
}
