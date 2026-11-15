import { useEffect, useRef, useState } from 'react';
import Icon from './icons';
import { downloadIcsFor, googleUrlFor, type FxMatch } from './fixture-utils';

type Props = { match: FxMatch; onToast: (message: string) => void; className: string; label: string };

/** "Takvime ekle": Google Takvim bağlantısı veya .ics indirme (2 saat önce hatırlatıcılı). */
export default function CalendarMenu({ match, onToast, className, label }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const google = googleUrlFor(match);
  return (
    <div className="dg-cal" ref={root}>
      <button type="button" className={className} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="calendarPlus" size={16} /><span>{label}</span><Icon name="chevron" size={13} />
      </button>
      {open && (
        <div className="dg-cal-menu" role="menu">
          <p>2 saat önce hatırlatıcı dahil</p>
          {google && <a role="menuitem" href={google} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span>Google Takvim</span><Icon name="external" size={14} /></a>}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onToast(downloadIcsFor([match], 'mac.ics') ? 'Takvim dosyası indirildi.' : 'Maç saati geçersiz, takvim oluşturulamadı.'); }}>
            <span>Apple / Outlook (.ics)</span><Icon name="download" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
