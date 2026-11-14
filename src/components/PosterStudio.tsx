import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPosterCopy,
  getPosterDimensions,
  type PosterFixture,
  type PosterFormat,
  type PosterTemplate,
} from '../poster/poster-utils';
import { renderPoster } from '../poster/poster-renderer';

type Props = {
  fixtures: PosterFixture[];
  verified: boolean;
};

function toPosterName(template: PosterTemplate, format: PosterFormat): string {
  return `darica-gucu-${template}-${format}.png`;
}

export default function PosterStudio({ fixtures, verified }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<PosterTemplate>('matchday');
  const [format, setFormat] = useState<PosterFormat>('portrait');
  const [fixtureId, setFixtureId] = useState(fixtures[0]?.id ?? '');
  const [title, setTitle] = useState('MAÇ GÜNÜ');
  const [subtitle, setSubtitle] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [announcementText, setAnnouncementText] = useState('Yeni dönem kayıtlarımız başladı');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [caption, setCaption] = useState('');
  const [renderError, setRenderError] = useState('');
  const [rendering, setRendering] = useState(false);
  const [feedback, setFeedback] = useState('');

  const eligibleFixtures = useMemo(() => fixtures.filter((match) => match.status === 'scheduled'), [fixtures]);
  const selectedFixture = useMemo(() => eligibleFixtures.find((match) => match.id === fixtureId) ?? eligibleFixtures[0] ?? null, [eligibleFixtures, fixtureId]);

  useEffect(() => {
    if (!photoFile) {
      setPhoto(null);
      return;
    }
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
    return () => {
      URL.revokeObjectURL(url);
      image.onload = null;
      image.onerror = null;
    };
  }, [photoFile]);

  useEffect(() => {
    setFixtureId(eligibleFixtures[0]?.id ?? '');
  }, [eligibleFixtures]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    setRendering(true);
    setRenderError('');
    setFeedback('');
    try {
      const fixture = selectedFixture ? {
        ...selectedFixture,
        homeScore: homeScore.trim() === '' ? undefined : Number(homeScore),
        awayScore: awayScore.trim() === '' ? undefined : Number(awayScore),
      } : null;
      const copy = buildPosterCopy({
        template,
        fixture,
        fixtures: eligibleFixtures,
        verified,
        title: template === 'announcement' ? (title || 'KULÜP DUYURUSU') : title,
        subtitle: template === 'announcement' ? announcementText : subtitle,
      });
      setCaption(copy.caption);
      void renderPoster(canvas, { format, template, copy, photo }).then(() => {
        if (active) setRendering(false);
      }).catch((reason: unknown) => {
        if (!active) return;
        setRenderError(reason instanceof Error ? reason.message : 'Afiş çizilemedi.');
        setRendering(false);
      });
    } catch (reason) {
      setRenderError(reason instanceof Error ? reason.message : 'Afiş oluşturulamadı.');
      setCaption('');
      setRendering(false);
    }
    return () => { active = false; };
  }, [template, format, selectedFixture, eligibleFixtures, verified, title, subtitle, homeScore, awayScore, announcementText, photo]);

  async function canvasBlob(): Promise<Blob> {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Afiş önizlemesi hazır değil.');
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG dosyası oluşturulamadı.')), 'image/png');
    });
  }

  async function downloadPoster() {
    try {
      const blob = await canvasBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = toPosterName(template, format);
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
      const file = new File([blob], toPosterName(template, format), { type: 'image/png' });
      const shareData: ShareData = { files: [file], title: title || 'Darıca Gücü', text: caption };
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
        setFeedback('Paylaşım menüsü açıldı. WhatsApp grubunu seçerek gönderimi tamamlayabilirsin.');
        return;
      }
      await downloadPoster();
      window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank', 'noopener,noreferrer');
      setFeedback('PNG indirildi; WhatsApp metin paylaşımı açıldı. Görseli gruba eklemek için indirilen dosyayı seç.');
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

  const dimensions = getPosterDimensions(format);
  const selectedLabel = selectedFixture ? `${selectedFixture.group} · ${selectedFixture.home} – ${selectedFixture.away}` : 'Karşılaşma seçilmedi';

  return (
    <section className="poster-studio page-enter">
      <div className="poster-studio-heading">
        <div>
          <span className="eyebrow">SOSYAL MEDYA · WHATSAPP · KULÜP DUYURULARI</span>
          <h2>Afiş Stüdyosu</h2>
          <p>Maç gününü, haftalık programı veya kulüp duyurunu tek dokunuşla yüksek çözünürlüklü görsele dönüştür.</p>
        </div>
        <span className="poster-studio-mark">DG <b>CREATIVE</b></span>
      </div>

      <div className="poster-workspace">
        <div className="poster-editor glass-card">
          <div className="panel-heading">
            <div><span className="eyebrow">TASARIM KONTROLÜ</span><h3>Şablonunu seç</h3></div>
            <span className="editor-step">01 / 03</span>
          </div>

          <div className="poster-template-grid">
            <button type="button" className={template === 'matchday' ? 'poster-template active' : 'poster-template'} onClick={() => { setTemplate('matchday'); setTitle('MAÇ GÜNÜ'); }}>
              <span className="template-art template-art-match"><b>VS</b><i/></span><strong>Maç günü</strong><small>Karşılaşma duyurusu</small>
            </button>
            <button type="button" className={template === 'weekly-program' ? 'poster-template active' : 'poster-template'} disabled={!verified || eligibleFixtures.length === 0} onClick={() => { setTemplate('weekly-program'); setTitle('HAFTALIK PROGRAM'); }}>
              <span className="template-art template-art-week"><b>01</b><i/><i/><i/></span><strong>Haftalık program</strong><small>Haftanın maç listesi</small>
            </button>
            <button type="button" className={template === 'result' ? 'poster-template active' : 'poster-template'} disabled={!verified || !selectedFixture} onClick={() => { setTemplate('result'); setTitle('MAÇ SONUCU'); }}>
              <span className="template-art template-art-result"><b>2 : 1</b><i/></span><strong>Maç sonucu</strong><small>Skoru sen gir</small>
            </button>
            <button type="button" className={template === 'announcement' ? 'poster-template active' : 'poster-template'} onClick={() => { setTemplate('announcement'); setTitle('KULÜP DUYURUSU'); }}>
              <span className="template-art template-art-news"><b>DG</b><i/></span><strong>Kulüp duyurusu</strong><small>Genel duyurular</small>
            </button>
          </div>

          <label className="poster-field">
            <span>Çıktı oranı</span>
            <select value={format} onChange={(event) => setFormat(event.target.value as PosterFormat)}>
              <option value="portrait">Dikey gönderi · 4:5 · 1080×1350</option>
              <option value="square">Kare gönderi · 1:1 · 1080×1080</option>
              <option value="story">Hikâye / WhatsApp Durum · 9:16 · 1080×1920</option>
            </select>
          </label>

          {template !== 'announcement' && (
            <label className="poster-field">
              <span>Karşılaşma</span>
              <select value={selectedFixture?.id ?? ''} onChange={(event) => setFixtureId(event.target.value)} disabled={!verified || template === 'weekly-program'}>
                {eligibleFixtures.map((match) => <option key={match.id} value={match.id}>{match.group} · {match.home} – {match.away}</option>)}
              </select>
              {template === 'weekly-program' && <small>Doğrulanmış programdaki en fazla 7 Darıca Gücü karşılaşması kullanılır.</small>}
            </label>
          )}

          <label className="poster-field">
            <span>Ana başlık</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={42} placeholder="Afiş başlığı"/>
          </label>
          {template === 'announcement' ? (
            <label className="poster-field">
              <span>Duyuru metni</span>
              <textarea value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} maxLength={180} rows={3}/>
            </label>
          ) : (
            <label className="poster-field">
              <span>Alt başlık</span>
              <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={64} placeholder="Örn. Takımımızı destekle"/>
            </label>
          )}

          {template === 'result' && (
            <p className="poster-score-warning">Skor verisi ASKF fikstüründen gelmiyor. Paylaşmadan önce iki takımın sonucunu doğrula.</p>
            <div className="poster-score-fields">
              <label className="poster-field"><span>{selectedFixture?.home ?? 'Ev sahibi'} skoru</span><input inputMode="numeric" type="number" min="0" max="99" value={homeScore} onChange={(event) => setHomeScore(event.target.value)}/></label>
              <label className="poster-field"><span>{selectedFixture?.away ?? 'Deplasman'} skoru</span><input inputMode="numeric" type="number" min="0" max="99" value={awayScore} onChange={(event) => setAwayScore(event.target.value)}/></label>
            </div>
          )}

          <label className="poster-field poster-upload">
            <span>Takım fotoğrafı <small>İsteğe bağlı · 12 MB'a kadar</small></span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}/>
          </label>
          {photoFile && <button type="button" className="subtle-link remove-photo" onClick={() => setPhotoFile(null)}>Fotoğrafı kaldır</button>}
          <div className="poster-source-note">
            <span className={verified || template === 'announcement' ? 'source-check active' : 'source-check'}>✓</span>
            <span>{template === 'announcement' ? 'Genel kulüp duyurusu; fikstür iddiası içermez.' : verified ? selectedLabel : 'Maç afişleri için doğrulanmış ASKF programı gereklidir.'}</span>
          </div>
        </div>

        <div className="poster-preview-column">
          <div className="poster-preview-top">
            <div><span className="eyebrow">CANLI ÖNİZLEME</span><h3>Tasarımın</h3></div>
            <span className="poster-resolution">{dimensions.width} × {dimensions.height} PX</span>
          </div>
          <div className={`poster-canvas-frame poster-preview-${format}`}>
            <canvas ref={canvasRef} className="poster-canvas" aria-label="Darıca Gücü sosyal medya afişi önizlemesi"/>
            {rendering && <div className="poster-rendering">Afiş oluşturuluyor…</div>}
          </div>
          {renderError && <p className="poster-error" role="alert">{renderError}</p>}
          <div className="poster-export-actions">
            <button type="button" className="primary-button" disabled={rendering || Boolean(renderError)} onClick={() => void sharePoster()}>Görseli paylaş <span aria-hidden="true">↗</span></button>
            <button type="button" className="glass-button" disabled={rendering || Boolean(renderError)} onClick={() => void downloadPoster()}>PNG indir ↓</button>
            <button type="button" className="glass-button" disabled={!caption} onClick={() => void copyCaption()}>Metni kopyala</button>
          </div>
          <p className="poster-share-hint">Telefonun paylaşım menüsünden WhatsApp grubunu, Instagram'ı veya başka bir uygulamayı seç. Desteklenmeyen cihazlarda PNG indirilir ve WhatsApp metni açılır.</p>
          {feedback && <p className="poster-feedback" role="status">{feedback}</p>}
        </div>
      </div>
    </section>
  );
}
