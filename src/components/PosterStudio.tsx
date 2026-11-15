import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPosterCopy,
  formattedPosterDate,
  type PosterFixture,
  type PosterFormat,
  type PosterTemplate,
} from '../poster/poster-utils';
import { renderPoster } from '../poster/poster-renderer';
import { renderPosterTemplate, type PosterTemplateRequest } from '../poster/poster-catalog';
import { SHORTS_THEMES, type ShortsThemeId, type Weather } from '../poster/poster-layouts';
import { countdownTo } from '../media/countdown';
import { getSponsors } from '../media/sponsors';
import type { PublicPlayer } from '../players/model';
import PlayerManager from './PlayerManager';
import './poster-studio.css';

type Props = {
  fixtures: PosterFixture[];
  verified: boolean;
};

type Tab = 'instagram' | 'story' | 'shorts';
type StoryVariant = 'classic' | 'a' | 'c';

const TEMPLATE_LABEL: Record<PosterTemplate, string> = {
  matchday: 'Maç günü', 'weekly-program': 'Haftalık program', result: 'Maç sonucu', announcement: 'Kulüp duyurusu',
};
const TITLE_DEFAULT: Record<PosterTemplate, string> = {
  matchday: 'MAÇ GÜNÜ', 'weekly-program': 'HAFTALIK PROGRAM', result: 'MAÇ SONUCU', announcement: 'KULÜP DUYURUSU',
};
const CATALOG_ID = {
  matchday: 'matchday-45', 'weekly-program': 'weekly-program-45', result: 'result-45', announcement: 'announcement-45',
} as const;
const SHORTS_BADGES = ['MAÇ GÜNÜ', 'MAÇ ÖZETİ', 'VİDEO YAYINDA', 'EN İYİ ANLAR & MVP'];

function Icon({ name }: { name: 'download' | 'share' | 'chat' | 'send' | 'copy' | 'camera' | 'sparkle' | 'building' }) {
  const paths: Record<string, string> = {
    download: 'M12 3v12m0 0l-4-4m4 4l4-4M5 19h14',
    share: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
    chat: 'M4 5h16v11H8l-4 4V5z',
    send: 'M3 11l18-8-8 18-2-8-8-2z',
    copy: 'M9 9h11v11H9zM5 15V4h11',
    camera: 'M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8z',
    sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
    building: 'M4 21V5l8-2v18M12 9h8v12M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2',
  };
  return <svg className="pss-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}

function toPosterName(id: string): string {
  return `darica-gucu-${id}.png`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Görsel okunamadı.'));
    image.src = src;
  });
}

export default function PosterStudio({ fixtures, verified }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<Tab>('instagram');
  const [igFormat, setIgFormat] = useState<'portrait' | 'square'>('portrait');
  const [storyVariant, setStoryVariant] = useState<StoryVariant>('a');
  const [template, setTemplate] = useState<PosterTemplate>('matchday');
  const [shortsTheme, setShortsTheme] = useState<ShortsThemeId>('club-emerald');
  const [shortsHook, setShortsHook] = useState('MAÇ GÜNÜ');
  const [shortsBadge, setShortsBadge] = useState(SHORTS_BADGES[0]);
  const [shortsSubtitle, setShortsSubtitle] = useState('');
  const [fixtureId, setFixtureId] = useState(fixtures[0]?.id ?? '');
  const [title, setTitle] = useState('MAÇ GÜNÜ');
  const [subtitle, setSubtitle] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [announcementText, setAnnouncementText] = useState('Yeni dönem kayıtlarımız başladı');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [crest, setCrest] = useState<HTMLImageElement | null>(null);
  const [sponsorsOn, setSponsorsOn] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [minuteTick, setMinuteTick] = useState(0);
  const [mvp, setMvp] = useState<PublicPlayer | null>(null);
  const [mvpImage, setMvpImage] = useState<HTMLImageElement | null>(null);
  const [caption, setCaption] = useState('');
  const [renderError, setRenderError] = useState('');
  const [rendering, setRendering] = useState(false);
  const [dims, setDims] = useState({ width: 1080, height: 1350 });
  const [feedback, setFeedback] = useState('');

  const eligibleFixtures = useMemo(() => fixtures.filter((match) => match.status === 'scheduled'), [fixtures]);
  const selectedFixture = useMemo(() => eligibleFixtures.find((match) => match.id === fixtureId) ?? eligibleFixtures[0] ?? null, [eligibleFixtures, fixtureId]);
  const sponsorList = useMemo(() => getSponsors(), []);
  const sponsorsPending = sponsorList.some((sponsor) => !sponsor.approvedByOwner);

  const feedTemplateActive = tab === 'instagram' || (tab === 'story' && storyVariant === 'classic');
  const usesPhoto = feedTemplateActive || (tab === 'story' && storyVariant === 'a') || tab === 'shorts';
  const needsFixture = !(feedTemplateActive && template === 'announcement');

  // Gerçek kulüp arması (public/brand). Yüklenemezse çizilen kalkan kullanılır.
  useEffect(() => {
    let active = true;
    loadImage('/brand/darica-gucu-arma.png').then((image) => { if (active) setCrest(image); }).catch(() => { if (active) setCrest(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!photoFile) { setPhoto(null); return; }
    if (!photoFile.type.startsWith('image/') || photoFile.size > 12 * 1024 * 1024) {
      setRenderError('Fotoğraf PNG, JPG veya WebP olmalı ve 12 MB sınırını aşmamalı.');
      setPhotoFile(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    const image = new Image();
    image.onload = () => setPhoto(image);
    image.onerror = () => setRenderError('Seçilen fotoğraf okunamadı.');
    image.src = url;
    return () => { URL.revokeObjectURL(url); image.onload = null; image.onerror = null; };
  }, [photoFile]);

  useEffect(() => { setFixtureId(eligibleFixtures[0]?.id ?? ''); }, [eligibleFixtures]);

  // MVP fotoğrafı (yalnız hasPhoto ise, aynı kaynaktan).
  useEffect(() => {
    if (!mvp?.hasPhoto) { setMvpImage(null); return; }
    let active = true;
    loadImage(`/api/player-photo?id=${encodeURIComponent(mvp.id)}&v=${encodeURIComponent(mvp.updatedAt)}`)
      .then((image) => { if (active) setMvpImage(image); }).catch(() => { if (active) setMvpImage(null); });
    return () => { active = false; };
  }, [mvp?.id, mvp?.hasPhoto, mvp?.updatedAt]);

  const onPlayers = useCallback((list: PublicPlayer[]) => {
    setMvp((current) => (current ? list.find((player) => player.id === current.id) ?? null : null));
  }, []);

  // Hikaye A: hava durumu yalnız sunucu "available:true" derse; değilse hiç gösterilmez.
  const weatherAt = tab === 'story' && storyVariant === 'a' && selectedFixture ? `${selectedFixture.date}T${selectedFixture.time}` : '';
  useEffect(() => {
    setWeather(null);
    if (!weatherAt) return;
    const controller = new AbortController();
    fetch(`/api/weather?at=${encodeURIComponent(weatherAt)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { available?: boolean; temperatureC?: number; label?: string; source?: string } | null) => {
        if (data?.available === true && typeof data.temperatureC === 'number' && data.label) {
          setWeather({ tempC: data.temperatureC, label: data.label, source: data.source ?? '' });
        }
      })
      .catch(() => { /* kart gösterilmez */ });
    return () => controller.abort();
  }, [weatherAt]);

  // Geri sayım dakika çözünürlüklü; yalnız Hikaye A açıkken tazelenir.
  const countdownActive = tab === 'story' && storyVariant === 'a';
  useEffect(() => {
    if (!countdownActive) return;
    const timer = window.setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [countdownActive]);

  const sponsorNames = useMemo(() => (sponsorsOn ? sponsorList.map((sponsor) => sponsor.name) : []), [sponsorsOn, sponsorList]);
  const numericScore = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value));

  // Aktif şablonun kimliği (indirme adı ve rapor için).
  const posterId = tab === 'shorts' ? `shorts-${shortsTheme}`
    : tab === 'story' ? (storyVariant === 'classic' ? `${template}-story` : `story-${storyVariant}`)
      : (igFormat === 'portrait' ? CATALOG_ID[template] : `${template}-square`);

  useEffect(() => {
    const visible = canvasRef.current;
    if (!visible) return;
    let active = true;
    setRendering(true);
    setRenderError('');
    setFeedback('');
    const fail = (reason: unknown, fallback: string) => {
      if (!active) return;
      setRenderError(reason instanceof Error ? reason.message : fallback);
      setRendering(false);
    };
    (async () => {
      const homeN = numericScore(homeScore);
      const awayN = numericScore(awayScore);
      const fixture = selectedFixture ? { ...selectedFixture, homeScore: homeN, awayScore: awayN } : null;
      // WhatsApp metni ve doğrulama kapısı: maç içeren her afiş doğrulanmış ASKF verisi ister.
      const captionTemplate: PosterTemplate = feedTemplateActive ? template
        : (storyVariant === 'c' && tab === 'story' && Number.isInteger(homeN) && Number.isInteger(awayN) ? 'result' : 'matchday');
      const copy = buildPosterCopy({
        template: captionTemplate,
        fixture,
        fixtures: eligibleFixtures,
        verified,
        title: captionTemplate === 'announcement' ? (title || 'KULÜP DUYURUSU') : title,
        subtitle: captionTemplate === 'announcement' ? announcementText : subtitle,
      });
      if (active) setCaption(copy.caption);

      const off = document.createElement('canvas');
      const sponsors = sponsorNames;
      let result: { width: number; height: number };
      if (tab === 'shorts') {
        if (!fixture) throw new Error('Afiş için karşılaşma seçilmelidir.');
        const request: PosterTemplateRequest = {
          id: 'shorts-cover',
          input: { theme: shortsTheme, hook: shortsHook, badge: shortsBadge, subtitle: shortsSubtitle, home: fixture.home, away: fixture.away, sponsors, background: photo, crest },
        };
        result = await renderPosterTemplate(off, request);
      } else if (tab === 'story' && storyVariant === 'a') {
        if (!fixture) throw new Error('Afiş için karşılaşma seçilmelidir.');
        const cd = countdownTo({ date: fixture.date, time: fixture.time }, new Date());
        result = await renderPosterTemplate(off, {
          id: 'story-a',
          input: {
            title, group: fixture.group, home: fixture.home, away: fixture.away,
            date: formattedPosterDate(fixture.date), time: fixture.time, venue: fixture.venue,
            countdown: cd ? { days: cd.days, hours: cd.hours, minutes: cd.minutes } : null,
            weather, sponsors, photo, crest,
          },
        });
      } else if (tab === 'story' && storyVariant === 'c') {
        if (!fixture) throw new Error('Afiş için karşılaşma seçilmelidir.');
        const hasScore = Number.isInteger(homeN) && Number.isInteger(awayN);
        result = await renderPosterTemplate(off, {
          id: 'story-c',
          input: {
            home: fixture.home, away: fixture.away, group: fixture.group,
            score: hasScore ? { home: homeN as number, away: awayN as number } : null,
            mvp: mvp ? { name: mvp.name, number: mvp.number, position: mvp.position, photo: mvp.hasPhoto ? mvpImage : null } : null,
            sponsors, crest,
          },
        });
      } else if (tab === 'instagram' && igFormat === 'portrait') {
        result = await renderPosterTemplate(off, { id: CATALOG_ID[template], input: { copy, sponsors, photo, crest } });
      } else {
        const format: PosterFormat = tab === 'story' ? 'story' : 'square';
        await renderPoster(off, { format, template, copy, photo, sponsors, crest });
        result = { width: off.width, height: off.height };
      }
      if (!active) return;
      // Yarış önleme: tuvale yalnız en güncel çizim aktarılır.
      visible.width = off.width;
      visible.height = off.height;
      visible.getContext('2d')?.drawImage(off, 0, 0);
      setDims({ width: result.width, height: result.height });
      setRendering(false);
    })().catch((reason: unknown) => {
      if (!active) return;
      setCaption('');
      fail(reason, 'Afiş oluşturulamadı.');
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, igFormat, storyVariant, template, shortsTheme, shortsHook, shortsBadge, shortsSubtitle, selectedFixture, eligibleFixtures, verified, title, subtitle,
    homeScore, awayScore, announcementText, photo, crest, sponsorNames, weather, mvp, mvpImage, minuteTick]);

  async function canvasBlob(): Promise<Blob> {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Afiş önizlemesi hazır değil.');
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG dosyası oluşturulamadı.'))), 'image/png');
    });
  }

  async function downloadPoster() {
    try {
      const blob = await canvasBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = toPosterName(posterId);
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback('PNG afiş cihazına indirildi.');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'İndirme başarısız.');
    }
  }

  async function sharePoster() {
    try {
      const blob = await canvasBlob();
      const file = new File([blob], toPosterName(posterId), { type: 'image/png' });
      const shareData: ShareData = { files: [file], title: title || 'Darıca Gücü', text: caption };
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
        setFeedback('Paylaşım menüsü açıldı. Hikaye veya WhatsApp grubunu seçerek gönderimi tamamlayabilirsin.');
        return;
      }
      await downloadPoster();
      window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank', 'noopener,noreferrer');
      setFeedback('PNG indirildi; WhatsApp metin paylaşımı açıldı. Görseli eklemek için indirilen dosyayı seç.');
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setFeedback(reason instanceof Error ? reason.message : 'Paylaşım başlatılamadı.');
    }
  }

  async function copyCaption() {
    try {
      if (!caption) throw new Error('Önce paylaşım metni oluşturulmalı.');
      await navigator.clipboard.writeText(caption);
      setFeedback('WhatsApp açıklama metni kopyalandı.');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Metin kopyalanamadı.');
    }
  }

  function openWhatsapp() {
    if (!caption) { setFeedback('Önce paylaşım metni oluşturulmalı.'); return; }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`, '_blank', 'noopener,noreferrer');
    setFeedback('WhatsApp açılıyor.');
  }

  const selectedLabel = selectedFixture ? `${selectedFixture.group} · ${selectedFixture.home} – ${selectedFixture.away}` : 'Karşılaşma seçilmedi';
  const blocked = rendering || Boolean(renderError);
  const showScore = (feedTemplateActive && template === 'result') || (tab === 'story' && storyVariant === 'c');

  function goTab(next: Tab, variant: StoryVariant = storyVariant) {
    setTab(next);
    setStoryVariant(variant);
    if (next === 'story' && variant === 'a') setTitle('MAÇ GÜNÜ');
    else if (next === 'instagram' || (next === 'story' && variant === 'classic')) setTitle(TITLE_DEFAULT[template]);
  }

  function chooseTemplate(next: PosterTemplate) {
    setTemplate(next);
    setTitle(TITLE_DEFAULT[next]);
  }

  return (
    <section className="pss page-enter" aria-label="Medya ve paylaşım stüdyosu">
      <div className="pss-intro">
        <div className="pss-intro-copy">
          <div className="pss-kicker"><span className="pss-dot" aria-hidden="true"/><span>Tek Tıkla Paylaşım</span></div>
          <h2>Medya &amp; Paylaşım Stüdyosu</h2>
          <p>Haftalık indirilen maçları WhatsApp gruplarına ve sosyal medyaya tek tıkla paylaş</p>
        </div>
        <div className="pss-intro-mark" aria-hidden="true"><Icon name="sparkle"/></div>
      </div>

      <div className="pss-tabs-scroll">
        <div className="pss-tabs" role="group" aria-label="Çıktı biçimi">
          <button type="button" className={tab === 'instagram' ? 'pss-tab is-active' : 'pss-tab'} aria-pressed={tab === 'instagram'} onClick={() => goTab('instagram')}>Instagram (1080x{igFormat === 'portrait' ? '1350' : '1080'})</button>
          <button type="button" className={tab === 'story' ? 'pss-tab is-active' : 'pss-tab'} aria-pressed={tab === 'story'} onClick={() => goTab('story')}>Hikaye (9:16)</button>
          <button type="button" className={tab === 'shorts' ? 'pss-tab is-active' : 'pss-tab'} aria-pressed={tab === 'shorts'} onClick={() => goTab('shorts')}>Shorts / TikTok</button>
        </div>
      </div>

      <div className="pss-area-preview">
        <div className="pss-card pss-poster">
          <div className="pss-poster-bar">
            <span className="pss-poster-bar-title"><Icon name="camera"/>Afiş Canlı Çıktı [{dims.width} × {dims.height}]</span>
            <span className="pss-poster-bar-meta"><span className="pss-dot pss-dot-sm" aria-hidden="true"/>PNG · {dims.width} PX</span>
          </div>
          <div className="pss-stage" data-render-state={renderError ? 'error' : rendering ? 'rendering' : 'done'} data-poster-id={posterId}>
            <canvas ref={canvasRef} className="pss-canvas" aria-label="Darıca Gücü sosyal medya afişi önizlemesi"/>
            {rendering && <div className="pss-rendering">Afiş oluşturuluyor…</div>}
          </div>
        </div>
        {renderError && <p className="pss-alert pss-alert-error" role="alert">{renderError}</p>}
        <div className="pss-actions">
          <button type="button" className="pss-btn pss-btn-primary" disabled={blocked} onClick={() => void downloadPoster()}><Icon name="download"/>PNG İndir</button>
          <button type="button" className="pss-btn pss-btn-secondary" disabled={blocked} onClick={() => void sharePoster()}><Icon name="share"/>Hikayede Paylaş</button>
        </div>
        {feedback && <p className="pss-alert pss-alert-ok" role="status">{feedback}</p>}
      </div>

      <div className="pss-area-content">
        <div className="pss-card pss-pad">
          <div className="pss-card-head"><span className="pss-card-title">Afiş İçeriği</span></div>

          {tab === 'story' && (
            <div className="pss-chips" role="group" aria-label="Hikaye varyantı">
              <button type="button" className={storyVariant === 'a' ? 'pss-chip is-active' : 'pss-chip'} aria-pressed={storyVariant === 'a'} onClick={() => goTab('story', 'a')}>A · Geri sayım + hava</button>
              <button type="button" className={storyVariant === 'c' ? 'pss-chip is-active' : 'pss-chip'} aria-pressed={storyVariant === 'c'} onClick={() => goTab('story', 'c')}>C · MVP + skor</button>
              <button type="button" className={storyVariant === 'classic' ? 'pss-chip is-active' : 'pss-chip'} aria-pressed={storyVariant === 'classic'} onClick={() => goTab('story', 'classic')}>Klasik</button>
            </div>
          )}

          {tab === 'instagram' && (
            <div className="pss-chips" role="group" aria-label="Gönderi oranı">
              <button type="button" className={igFormat === 'portrait' ? 'pss-chip is-active' : 'pss-chip'} aria-pressed={igFormat === 'portrait'} onClick={() => setIgFormat('portrait')}>Dikey 4:5</button>
              <button type="button" className={igFormat === 'square' ? 'pss-chip is-active' : 'pss-chip'} aria-pressed={igFormat === 'square'} onClick={() => setIgFormat('square')}>Kare 1:1</button>
            </div>
          )}

          {feedTemplateActive && (
            <div className="pss-chips" role="group" aria-label="Şablon">
              {(Object.keys(TEMPLATE_LABEL) as PosterTemplate[]).map((id) => (
                <button key={id} type="button" className={template === id ? 'pss-chip is-active' : 'pss-chip'} aria-pressed={template === id}
                  disabled={(id === 'weekly-program' && (!verified || eligibleFixtures.length === 0)) || (id === 'result' && (!verified || !selectedFixture))}
                  onClick={() => chooseTemplate(id)}>{TEMPLATE_LABEL[id]}</button>
              ))}
            </div>
          )}

          {tab === 'shorts' && (
            <div className="pss-chips" role="group" aria-label="Kapak teması">
              {Object.values(SHORTS_THEMES).map((theme) => (
                <button key={theme.id} type="button" className={shortsTheme === theme.id ? 'pss-chip is-active' : 'pss-chip'} aria-pressed={shortsTheme === theme.id} onClick={() => setShortsTheme(theme.id)}>
                  <span className="pss-swatch" style={{ background: theme.accent }} aria-hidden="true"/>{theme.name}
                </button>
              ))}
            </div>
          )}

          {needsFixture && (
            <label className="pss-field"><span>Karşılaşma</span>
              <select value={selectedFixture?.id ?? ''} onChange={(event) => setFixtureId(event.target.value)} disabled={!verified || (feedTemplateActive && template === 'weekly-program')}>
                {eligibleFixtures.map((match) => <option key={match.id} value={match.id}>{match.group} · {match.home} – {match.away}</option>)}
              </select>
              {feedTemplateActive && template === 'weekly-program' && <small>Doğrulanmış programdaki en fazla 7 Darıca Gücü karşılaşması kullanılır.</small>}
            </label>
          )}

          {tab === 'shorts' ? (
            <>
              <label className="pss-field"><span>Kapak başlığı</span><input value={shortsHook} onChange={(event) => setShortsHook(event.target.value)} maxLength={60} placeholder="Kapak başlığı"/></label>
              <label className="pss-field"><span>Rozet</span>
                <select value={shortsBadge} onChange={(event) => setShortsBadge(event.target.value)}>{SHORTS_BADGES.map((badge) => <option key={badge} value={badge}>{badge}</option>)}</select></label>
              <label className="pss-field"><span>Alt başlık</span><input value={shortsSubtitle} onChange={(event) => setShortsSubtitle(event.target.value)} maxLength={64} placeholder="İsteğe bağlı"/></label>
            </>
          ) : tab === 'story' && storyVariant === 'c' ? null : (
            <>
              <label className="pss-field"><span>Ana başlık</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={42} placeholder="Afiş başlığı"/></label>
              {tab === 'story' && storyVariant === 'a' ? null : feedTemplateActive && template === 'announcement' ? (
                <label className="pss-field"><span>Duyuru metni</span><textarea value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} maxLength={180} rows={3}/></label>
              ) : (
                <label className="pss-field"><span>Alt başlık</span><input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={64} placeholder="Örn. Takımımızı destekle"/></label>
              )}
            </>
          )}

          {showScore && (
            <>
              <p className="pss-warn">Skor verisi ASKF fikstüründen gelmiyor.{tab === 'story' ? ' Boş bırakırsan afişte skor görünmez.' : ''} Paylaşmadan önce iki takımın sonucunu doğrula.</p>
              <div className="pss-two">
                <label className="pss-field"><span>{selectedFixture?.home ?? 'Ev sahibi'} skoru</span><input inputMode="numeric" type="number" min="0" max="99" value={homeScore} onChange={(event) => setHomeScore(event.target.value)}/></label>
                <label className="pss-field"><span>{selectedFixture?.away ?? 'Deplasman'} skoru</span><input inputMode="numeric" type="number" min="0" max="99" value={awayScore} onChange={(event) => setAwayScore(event.target.value)}/></label>
              </div>
            </>
          )}

          {tab === 'story' && storyVariant === 'c' && (
            <p className="pss-note">{mvp ? `Maçın oyuncusu: ${mvp.name} (#${mvp.number})` : 'Maçın oyuncusu seçilmedi. Aşağıdaki Oyuncular bölümünden MVP seç.'}</p>
          )}
          {tab === 'story' && storyVariant === 'a' && (
            <p className="pss-note">Geri sayım maç saatine göre hesaplanır; maç başladıysa gösterilmez. Hava durumu yalnız tahmin alınabilirse görünür.</p>
          )}

          {usesPhoto && (
            <>
              <label className="pss-field pss-upload"><span>{tab === 'shorts' ? 'Arka plan fotoğrafı' : 'Takım fotoğrafı'} <small>İsteğe bağlı · 12 MB'a kadar</small></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}/></label>
              {photoFile && <button type="button" className="pss-link" onClick={() => setPhotoFile(null)}>Fotoğrafı kaldır</button>}
            </>
          )}
          <div className="pss-source">
            <span className={verified || !needsFixture ? 'pss-check is-on' : 'pss-check'} aria-hidden="true">✓</span>
            <span>{!needsFixture ? 'Genel kulüp duyurusu; fikstür iddiası içermez.' : verified ? selectedLabel : 'Maç afişleri için doğrulanmış ASKF programı gereklidir.'}</span>
          </div>
        </div>
      </div>

      <div className="pss-area-bulletin">
        <div className="pss-card pss-pad">
          <div className="pss-card-head">
            <span className="pss-card-title"><span className="pss-icon-box"><Icon name="chat"/></span>WhatsApp &amp; SMS Bülteni</span>
            <span className="pss-pill">{caption ? 'Hazır Taslak' : 'Taslak yok'}</span>
          </div>
          <div className="pss-bulletin">
            <textarea readOnly rows={7} value={caption} placeholder="Doğrulanmış maç seçildiğinde bülten metni burada oluşur." aria-label="WhatsApp bülten metni"/>
          </div>
          <div className="pss-two pss-actions-2">
            <button type="button" className="pss-btn pss-btn-green" disabled={!caption} onClick={openWhatsapp}><Icon name="send"/>WhatsApp Aç</button>
            <button type="button" className="pss-btn pss-btn-secondary pss-btn-plain" disabled={!caption} onClick={() => void copyCaption()}><Icon name="copy"/>Metni Kopyala</button>
          </div>
        </div>
      </div>

      <div className="pss-area-layers">
        <div className="pss-layers-head"><span>Afiş Katman Ayarları</span></div>
        <div className="pss-card pss-layers">
          <label className="pss-layer">
            <span className="pss-layer-main">
              <span className="pss-icon-box pss-icon-box-neutral"><Icon name="building"/></span>
              <span className="pss-layer-text">
                <strong>Resmi Sponsor Bandı</strong>
                <small>Sponsor adları afişin alt şeridine eklenir</small>
                {sponsorsPending && <small className="pss-pending">Sahibin onayı bekleniyor</small>}
              </span>
            </span>
            <input type="checkbox" checked={sponsorsOn} onChange={(event) => setSponsorsOn(event.target.checked)} aria-label="Sponsor bandı"/>
          </label>
        </div>
      </div>

      <div className="pss-area-players">
        <PlayerManager selectedId={mvp?.id ?? null} onSelect={setMvp} onPlayers={onPlayers}/>
      </div>
    </section>
  );
}
