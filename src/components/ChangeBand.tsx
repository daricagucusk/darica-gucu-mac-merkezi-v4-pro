import Icon from './icons';
import {
  changeHeadline, changeShareText, diffRows, downloadIcsFor, groupLabel, isCritical, isVerificationOnly, minutesAgoLabel,
  type FxChange, type FxMatch,
} from './fixture-utils';

type Props = {
  changes: FxChange[]; // yalnızca Darıca ile ilgili değişiklikler
  daricaMatches: FxMatch[];
  checkedAt?: string | null;
  sourceWeek?: number;
  now: Date;
  onShare: (text: string, title: string) => void;
  onToast: (message: string) => void;
  onOpenAll?: () => void;
};

/** Veli uyarı bandı (Stitch degisiklik_dedektoru): kritik değişiklik sarı bantta eski -> yeni olarak gösterilir. */
export default function ChangeBand({ changes, daricaMatches, checkedAt, sourceWeek, now, onShare, onToast, onOpenAll }: Props) {
  if (!changes.length) return null;
  const critical = changes.filter(isCritical);
  const verifyOnly = changes.some(isVerificationOnly);
  const shown = critical.length ? critical : changes;
  const badge = critical.length
    ? `${critical.length} KRİTİK GÜNCELLEME TESPİT EDİLDİ`
    : verifyOnly ? 'İPTAL DEĞİL · DOĞRULAMA GEREKLİ' : `${changes.length} PROGRAM HAREKETİ`;
  const title = shown.length === 1 ? changeHeadline(shown[0]) : `Darıca Gücü maçlarında ${shown.length} program değişikliği var!`;
  const rows = shown.slice(0, 4).flatMap((c) => diffRows(c).map((r) => ({
    ...r,
    key: `${c.fixtureId}-${r.key}`,
    group: shown.length > 1 ? groupLabel((c.current ?? c.previous)?.group) : '',
  })));
  const changedIds = new Set(changes.map((c) => c.current?.id ?? c.fixtureId));
  const unchanged = daricaMatches.filter((m) => !changedIds.has(m.id)).length;
  const ago = minutesAgoLabel(checkedAt, now);
  const calendarChanges = shown.filter((c) => c.current?.id && !isVerificationOnly(c));
  const updateCalendar = () => {
    const matches = calendarChanges.map((c) => c.current as FxMatch).filter((m) => m.date && m.time);
    onToast(matches.length && downloadIcsFor(matches, 'guncel-maclar.ics')
      ? 'Güncel maç saatleriyle takvim dosyası indirildi.'
      : 'Takvime işlenecek değişiklik yok.');
  };
  return (
    <section className="dg-band" aria-label="Program değişikliği uyarısı">
      <div className="dg-band-head">
        <div className="dg-band-lead">
          <span className="dg-band-icon"><Icon name="alert" size={20} /></span>
          <div className="dg-band-title">
            <div className="dg-band-badges">
              <span className="dg-band-badge"><i />{badge}</span>
              {sourceWeek ? <span className="dg-band-rev">ASKF programı · {sourceWeek}. hafta</span> : null}
            </div>
            <h4>{title}</h4>
          </div>
        </div>
        <span className="dg-band-diff"><Icon name="shieldCheck" size={12} />Program karşılaştırması</span>
      </div>
      {rows.length > 0 && (
        <div className="dg-band-rows">
          {rows.map((r) => (
            <div className="dg-band-row" key={r.key}>
              <span className="dg-band-label"><Icon name={r.icon} size={14} />{r.group ? `${r.group} · ` : ''}{r.label}</span>
              <span className="dg-band-vals"><s>{r.from}</s><b className="arrow">➔</b><b className={r.icon === 'pin' ? 'new green' : 'new'}>{r.to}</b></span>
            </div>
          ))}
        </div>
      )}
      {verifyOnly && <p className="dg-band-verify">Programda görünmeyen maç iptal edilmiş sayılmaz; resmî kaynaktan doğrulayın.</p>}
      <div className="dg-band-foot">
        <p>
          <Icon name="info" size={14} />
          <span>{ago ? `ASKF programı ${ago} kontrol edildi.` : 'ASKF kontrol saati bekleniyor.'}{unchanged > 0 ? ` Diğer ${unchanged} maçta değişiklik yoktur.` : ''}</span>
        </p>
        <div className="dg-band-actions">
          <button type="button" className="dg-btn-emerald" onClick={() => onShare(changeShareText(shown), 'Program Değişikliği')}><Icon name="message" size={14} />Veli Grubuna Acil Değişiklik Bildir</button>
          {calendarChanges.length > 0 && <button type="button" className="dg-btn-gold" onClick={updateCalendar}><Icon name="calendarCheck" size={14} />Takvimleri Güncelle</button>}
          {onOpenAll && <button type="button" className="dg-btn-gold ghost" onClick={onOpenAll}>Tüm değişiklikler</button>}
        </div>
      </div>
    </section>
  );
}
