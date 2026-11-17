// Saf yerleşim katmanı: her şablon -> çizilecek öğe listesi. Canvas yok; measure enjekte edilir.
// Görsel kaynak önceliği: Stitch screen.png > Stitch code.html (DOM) > Stitch canvas JS > prototip-index.
import type { PosterCopy, PosterFormat, PosterTemplate } from './poster-utils';
import { getPosterDimensions } from './poster-utils';
import {
  FONT_BODY, fitText, trUpper, wrapText,
  type Measure, type TextItem,
} from './poster-text';

export interface RectItem {
  kind: 'rect'; role: string; x: number; y: number; w: number; h: number; radius: number;
  fill?: string; stroke?: string; strokeWidth?: number;
}
export interface CircleItem {
  kind: 'circle'; role: string; cx: number; cy: number; r: number; fill?: string; stroke?: string; strokeWidth?: number;
}
export interface ShieldItem { kind: 'shield'; role: string; cx: number; cy: number; r: number; color: string; monogram: string }
export interface BgItem {
  kind: 'bg'; role: string; mode: 'linear' | 'radial';
  x0: number; y0: number; r0: number; x1: number; y1: number; r1: number;
  stops: ReadonlyArray<readonly [number, string]>;
}
export interface ImageItem {
  kind: 'image'; role: string; image: CanvasImageSource; x: number; y: number; w: number; h: number;
  shape: 'rect' | 'circle'; alpha: number; overlay?: string;
  /** Varsayılan 'cover' (kırpar). 'contain': görseli kırpmadan kutuya sığdırır (arma için). */
  fit?: 'cover' | 'contain';
  /** Logo karosu: köşe yuvarlama, koyu zemin ve ince çerçeve (Stitch arma karosu; arma şeffaf PNG'dir). */
  radius?: number; fill?: string; stroke?: string; strokeWidth?: number;
  /** Karo içinde görsel kenar payı (kutu oranı, 0..0.3). */
  inset?: number;
}
export type PosterItem = TextItem | RectItem | CircleItem | ShieldItem | BgItem | ImageItem;

export interface SafeZone { top: number; bottom: number }
export interface PosterLayout { width: number; height: number; safe: SafeZone; items: PosterItem[] }

export const SAFE_STORY: SafeZone = { top: 250, bottom: 250 };
/** Referans (shorts kapak box-shorts): üst %15, alt %20 güvenli alan kılavuzu; 250 px şartından katı. */
export const SAFE_SHORTS: SafeZone = { top: 288, bottom: 384 };
export const SAFE_FEED: SafeZone = { top: 0, bottom: 0 };

const W = 1080;

// ---- Ortak renkler (Stitch tailwind config + canvas JS) ----
const C = {
  green: '#00a859', bright: '#4ae176', gold: '#eab308', goldLight: '#fbbf24', silver: '#c1c7cf',
  pitch950: '#08100d', slate: '#94a3b8', slateLight: '#cbd5e1', mint: '#8dd6ae', blue: '#93c5fd',
};

function background(width: number, height: number): BgItem {
  return {
    kind: 'bg', role: 'background', mode: 'radial',
    x0: width / 2, y0: height * 0.25, r0: 80, x1: width / 2, y1: height / 2, r1: height * 0.75,
    stops: [[0, '#1a4b33'], [0.55, '#0d251a'], [1, '#050d09']],
  };
}

function frameItems(): RectItem[] {
  return [
    { kind: 'rect', role: 'frame', x: 28, y: 28, w: W - 56, h: 0, radius: 0, stroke: 'rgba(74, 225, 118, 0.45)', strokeWidth: 12 },
    { kind: 'rect', role: 'frame-gold', x: 38, y: 38, w: W - 76, h: 0, radius: 0, stroke: 'rgba(234, 179, 8, 0.35)', strokeWidth: 2 },
  ];
}

function framed(height: number): RectItem[] {
  const [a, b] = frameItems();
  return [{ ...a, h: height - 56 }, { ...b, h: height - 76 }];
}

/** Kulüp arması: crest verilmişse (şeffaf PNG) Stitch karosunda kırpmadan sığdırılan görsel, yoksa çizilen kalkan. */
function clubCrest(role: string, cx: number, cy: number, r: number, color: string, crest: CanvasImageSource | null | undefined): PosterItem {
  if (!crest) return { kind: 'shield', role, cx, cy, r, color, monogram: 'DG' };
  return {
    kind: 'image', role, image: crest, x: cx - r * 1.2, y: cy - r * 1.15, w: r * 2.4, h: r * 2.4, shape: 'rect', alpha: 1, fit: 'contain',
    radius: r * 0.38, fill: 'rgba(6, 16, 12, 0.92)', inset: 0.07, stroke: 'rgba(74, 225, 118, 0.75)', strokeWidth: 4,
  };
}

/** Afiş sponsoru: ad + isteğe bağlı alt satır + logo (null/yüklenemedi ise yazı rozeti çizilir). */
export interface PosterSponsor { name: string; sub?: string; logo?: CanvasImageSource | null }
export type SponsorInput = string | PosterSponsor;

export function normalizeSponsors(list: ReadonlyArray<SponsorInput> | null | undefined): PosterSponsor[] {
  const out: PosterSponsor[] = [];
  for (const entry of list ?? []) {
    const raw: PosterSponsor = typeof entry === 'string' ? { name: entry } : entry;
    const name = raw.name.trim();
    if (!name) continue;
    out.push({ name, sub: raw.sub?.trim() || undefined, logo: raw.logo ?? null });
  }
  return out;
}

export const SPONSOR_STRIP_H = 84;

function imageAspect(image: CanvasImageSource): number {
  const src = image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const w = src.naturalWidth ?? src.width ?? 1;
  const h = src.naturalHeight ?? src.height ?? 1;
  return h > 0 && w > 0 ? w / h : 1;
}

/** Stitch alt sponsor şeridi: logo rozeti (açık zemin, koyu logolar okunur) + ad + alt satır. Boş liste: öğe yok. */
function sponsorStrip(sponsors: ReadonlyArray<SponsorInput> | undefined, y: number, critical: boolean, measure: Measure): PosterItem[] {
  const list = normalizeSponsors(sponsors);
  if (list.length === 0) return [];
  const items: PosterItem[] = [
    { kind: 'rect', role: 'sponsor-strip', x: 36, y, w: W - 72, h: SPONSOR_STRIP_H, radius: 0, fill: 'rgba(6, 16, 12, 0.96)', stroke: 'rgba(234, 179, 8, 0.6)', strokeWidth: 2 },
  ];
  const x0 = 36 + 12;
  const cellW = (W - 72 - 24) / list.length;
  const cy = y + SPONSOR_STRIP_H / 2;
  list.forEach((sp, index) => {
    const cx0 = x0 + index * cellW;
    if (sp.logo) {
      const chipH = 62;
      const chipW = Math.max(66, Math.min(150, cellW * 0.46, imageAspect(sp.logo) * 46 + 20));
      items.push({ kind: 'rect', role: 'sponsor-chip', x: cx0 + 6, y: cy - chipH / 2, w: chipW, h: chipH, radius: 14, fill: '#eef3ef', stroke: 'rgba(234, 179, 8, 0.55)', strokeWidth: 2 });
      items.push({ kind: 'image', role: 'sponsor-logo', image: sp.logo, x: cx0 + 6 + 10, y: cy - chipH / 2 + 8, w: chipW - 20, h: chipH - 16, shape: 'rect', alpha: 1, fit: 'contain' });
      const tx = cx0 + 6 + chipW + 12;
      const tw = cellW - chipW - 24;
      items.push(fitText({ role: 'sponsor-name', text: sp.name, x: tx, y: sp.sub ? cy - 3 : cy + 7, maxWidth: tw, size: 21, minSize: 11, weight: 900, color: '#ffffff', upper: true, align: 'left', critical }, measure));
      if (sp.sub) items.push(fitText({ role: 'sponsor-sub', text: sp.sub, x: tx, y: cy + 22, maxWidth: tw, size: 15, minSize: 10, weight: 600, family: FONT_BODY, color: C.goldLight, align: 'left', critical }, measure));
    } else {
      const bw = cellW - 12;
      items.push({ kind: 'rect', role: 'sponsor-chip', x: cx0 + 6, y: cy - 31, w: bw, h: 62, radius: 14, fill: 'rgba(234, 179, 8, 0.12)', stroke: 'rgba(234, 179, 8, 0.65)', strokeWidth: 2 });
      items.push(fitText({ role: 'sponsor-name', text: sp.name, x: cx0 + 6 + bw / 2, y: sp.sub ? cy - 1 : cy + 9, maxWidth: bw - 28, size: 26, minSize: 12, weight: 900, color: C.goldLight, upper: true, critical }, measure));
      if (sp.sub) items.push(fitText({ role: 'sponsor-sub', text: sp.sub, x: cx0 + 6 + bw / 2, y: cy + 20, maxWidth: bw - 28, size: 14, minSize: 10, weight: 700, family: FONT_BODY, color: C.slateLight, upper: true, critical }, measure));
    }
  });
  return items;
}

// =====================================================================
// 1) Shorts / Reels kapak (1080x1920)
// =====================================================================
export type ShortsThemeId = 'youtube-red' | 'club-emerald';

export interface ShortsTheme {
  id: ShortsThemeId;
  name: string;
  /** Tema ana rengi (rozet kenarı, VS kutusu, çerçeve). Kaynak: prototip-index renderShortsCover. */
  accent: string;
  shield: string;
  frame: string;
  stops: ReadonlyArray<readonly [number, string]>;
}

export const SHORTS_THEMES: Record<ShortsThemeId, ShortsTheme> = {
  'youtube-red': {
    id: 'youtube-red', name: 'YouTube Kırmızı', accent: '#ef4444', shield: '#850d0d', frame: 'rgba(239, 68, 68, 0.4)',
    stops: [[0, '#5a0606'], [0.35, '#850d0d'], [0.7, '#240404'], [1, '#0c0202']],
  },
  'club-emerald': {
    id: 'club-emerald', name: 'Darıca Zümrüt', accent: '#10b981', shield: '#0a5c3d', frame: 'rgba(16, 185, 129, 0.4)',
    stops: [[0, '#06291a'], [0.4, '#0a422b'], [0.8, '#04150d'], [1, '#020905']],
  },
};

export interface ShortsInput {
  theme: ShortsThemeId;
  hook: string;
  badge: string;
  subtitle?: string;
  home: string;
  away: string;
  cta?: string;
  handle?: string;
  sponsors?: SponsorInput[];
  background?: CanvasImageSource | null;
  /** İsteğe bağlı gerçek kulüp arması; yoksa çizilen kalkan. */
  crest?: CanvasImageSource | null;
}

export function layoutShortsCover(input: ShortsInput, measure: Measure): PosterLayout {
  const w = 1080;
  const h = 1920;
  const t = SHORTS_THEMES[input.theme];
  const items: PosterItem[] = [
    { kind: 'bg', role: 'background', mode: 'linear', x0: 0, y0: 0, r0: 0, x1: w, y1: h, r1: 0, stops: t.stops },
  ];
  if (input.background) {
    items.push({ kind: 'image', role: 'photo', image: input.background, x: 0, y: 0, w, h, shape: 'rect', alpha: 0.42 });
  }
  items.push({ kind: 'rect', role: 'frame', x: 35, y: 45, w: w - 70, h: h - 90, radius: 0, stroke: t.frame, strokeWidth: 6 });

  items.push({ kind: 'rect', role: 'badge-pill', x: w / 2 - 240, y: 300, w: 480, h: 60, radius: 30, fill: 'rgba(0, 0, 0, 0.75)', stroke: t.accent, strokeWidth: 3 });
  items.push(fitText({ role: 'badge', text: input.badge, x: w / 2, y: 340, maxWidth: 430, size: 24, minSize: 14, weight: 900, color: '#ffffff' }, measure));

  items.push(clubCrest('crest', w / 2, 535, 110, t.shield, input.crest));

  const hookLines = wrapText({
    role: 'hook', text: input.hook, x: w / 2, y: 760, maxWidth: 900, size: 68, weight: 900, color: '#ffffff',
    lineHeight: 78, maxLines: 2, upper: true, shadow: true,
  }, measure);
  items.push(...hookLines);
  const subY = 760 + Math.max(0, hookLines.length - 1) * 78 + 62;
  const subtitle = input.subtitle?.trim();
  if (subtitle) {
    items.push(fitText({ role: 'subtitle', text: subtitle, x: w / 2, y: subY, maxWidth: 900, size: 32, minSize: 18, weight: 800, color: C.gold, upper: true }, measure));
  }

  const cardY = subY + 40;
  items.push({ kind: 'rect', role: 'vs-card', x: 90, y: cardY, w: w - 180, h: 340, radius: 32, fill: 'rgba(0, 0, 0, 0.72)', stroke: t.accent, strokeWidth: 4 });
  items.push(fitText({ role: 'home', text: input.home, x: w / 2, y: cardY + 100, maxWidth: 820, size: 52, minSize: 24, weight: 900, color: '#ffffff', upper: true }, measure));
  items.push({ kind: 'rect', role: 'vs-chip', x: w / 2 - 50, y: cardY + 140, w: 100, h: 60, radius: 16, fill: t.accent });
  items.push(fitText({ role: 'vs', text: 'VS', x: w / 2, y: cardY + 184, maxWidth: 90, size: 36, weight: 900, color: '#000000' }, measure));
  items.push(fitText({ role: 'away', text: input.away, x: w / 2, y: cardY + 280, maxWidth: 820, size: 48, minSize: 24, weight: 900, color: '#ffffff', upper: true }, measure));

  const ctaY = cardY + 340 + 40;
  items.push({ kind: 'rect', role: 'cta-pill', x: 140, y: ctaY, w: w - 280, h: 100, radius: 25, fill: 'rgba(0, 0, 0, 0.8)', stroke: '#ffffff', strokeWidth: 2 });
  items.push(fitText({ role: 'cta', text: input.cta?.trim() || '▶ İZLEMEK İÇİN DOKUNUN', x: w / 2, y: ctaY + 60, maxWidth: w - 340, size: 28, minSize: 16, weight: 900, color: '#ffffff', upper: true }, measure));
  items.push(fitText({ role: 'handle', text: input.handle?.trim() || '@daricagucuspor • #DarıcaGücüSK', x: w / 2, y: ctaY + 140, maxWidth: 900, size: 24, minSize: 14, weight: 800, family: FONT_BODY, color: '#ffffff' }, measure));

  items.push(...sponsorStrip(input.sponsors, h - 250, false, measure));
  return { width: w, height: h, safe: SAFE_SHORTS, items };
}

// =====================================================================
// 2) Hikaye A: split + geri sayım + hava (1080x1920)
// =====================================================================
export interface Countdown { days: number; hours: number; minutes: number }
export interface Weather { tempC: number; label: string; source: string }

export interface StoryAInput {
  title?: string;
  group: string;
  home: string;
  away: string;
  date: string;
  time: string;
  venue: string;
  countdown?: Countdown | null;
  weather?: Weather | null;
  sponsors?: SponsorInput[];
  photo?: CanvasImageSource | null;
  crest?: CanvasImageSource | null;
}

const two = (n: number): string => String(Math.max(0, Math.trunc(n))).padStart(2, '0');

export function layoutStoryA(input: StoryAInput, measure: Measure): PosterLayout {
  const h = 1920;
  const items: PosterItem[] = [background(W, h)];
  if (input.photo) {
    items.push({ kind: 'image', role: 'photo', image: input.photo, x: 0, y: 0, w: W, h, shape: 'rect', alpha: 1, overlay: 'rgba(8, 16, 13, 0.68)' });
  }
  items.push(...framed(h));
  items.push(clubCrest('crest', W / 2, 200, 130, '#0a5c3d', input.crest));

  const wx = input.weather;
  if (wx && Number.isFinite(wx.tempC) && wx.label.trim()) {
    items.push({ kind: 'rect', role: 'weather-pill', x: W / 2 - 320, y: 385, w: 640, h: 56, radius: 28, fill: 'rgba(10, 30, 22, 0.85)', stroke: 'rgba(59, 130, 246, 0.6)', strokeWidth: 2 });
    items.push(fitText({ role: 'weather', text: `${Math.round(wx.tempC)}°C  •  ${trUpper(wx.label.trim())}`, x: W / 2, y: 422, maxWidth: 590, size: 22, minSize: 13, weight: 800, color: C.blue }, measure));
    if (wx.source.trim()) {
      items.push(fitText({ role: 'weather-source', text: `Kaynak: ${wx.source.trim()}`, x: W / 2, y: 470, maxWidth: 640, size: 16, minSize: 11, weight: 500, family: FONT_BODY, color: C.slate }, measure));
    }
  }

  items.push(fitText({ role: 'title', text: input.title?.trim() || 'MAÇ GÜNÜ', x: W / 2, y: 540, maxWidth: 900, size: 64, minSize: 34, weight: 900, color: '#ffffff', upper: true }, measure));
  items.push(fitText({ role: 'group', text: input.group, x: W / 2, y: 590, maxWidth: 900, size: 30, minSize: 18, weight: 800, color: C.gold, upper: true }, measure));

  items.push({ kind: 'rect', role: 'match-card', x: 80, y: 630, w: W - 160, h: 420, radius: 30, fill: 'rgba(0, 0, 0, 0.7)', stroke: 'rgba(74, 225, 118, 0.4)', strokeWidth: 3 });
  items.push(fitText({ role: 'home', text: input.home, x: W / 2, y: 740, maxWidth: 840, size: 52, minSize: 24, weight: 900, color: '#ffffff', upper: true }, measure));
  items.push(fitText({ role: 'vs', text: 'VS', x: W / 2, y: 840, maxWidth: 200, size: 44, weight: 900, color: C.goldLight }, measure));
  items.push(fitText({ role: 'away', text: input.away, x: W / 2, y: 940, maxWidth: 840, size: 52, minSize: 24, weight: 900, color: '#ffffff', upper: true }, measure));

  items.push(fitText({ role: 'date', text: `${input.date} • ${input.time}`, x: W / 2, y: 1130, maxWidth: 940, size: 30, minSize: 18, weight: 800, color: '#ffffff' }, measure));
  items.push(fitText({ role: 'venue', text: input.venue, x: W / 2, y: 1185, maxWidth: 940, size: 24, minSize: 14, weight: 600, family: FONT_BODY, color: C.slateLight }, measure));

  const cd = input.countdown;
  if (cd && [cd.days, cd.hours, cd.minutes].every((n) => Number.isFinite(n) && n >= 0)) {
    const hudY = h - 480;
    items.push({ kind: 'rect', role: 'countdown-hud', x: 100, y: hudY, w: W - 200, h: 165, radius: 24, fill: 'rgba(10, 35, 24, 0.94)', stroke: 'rgba(234, 179, 8, 0.85)', strokeWidth: 3 });
    items.push(fitText({ role: 'countdown-title', text: 'BAŞLAMAYA KALAN SÜRE', x: W / 2, y: hudY + 38, maxWidth: 760, size: 20, minSize: 12, weight: 900, color: C.gold }, measure));
    const cells: Array<[string, string, string]> = [
      [two(cd.days), 'GÜN', '#ffffff'], [two(cd.hours), 'SAAT', '#ffffff'], [two(cd.minutes), 'DAKİKA', C.bright],
    ];
    cells.forEach(([value, label, color], index) => {
      const px = W / 2 - 330 + index * 230;
      items.push({ kind: 'rect', role: 'countdown-pill', x: px, y: hudY + 58, w: 200, h: 80, radius: 16, fill: '#06100c', stroke: 'rgba(255, 255, 255, 0.22)', strokeWidth: 2 });
      items.push(fitText({ role: `countdown-${label}`, text: value, x: px + 100, y: hudY + 58 + 48, maxWidth: 180, size: 38, minSize: 22, weight: 900, color }, measure));
      items.push(fitText({ role: `countdown-label-${label}`, text: label, x: px + 100, y: hudY + 58 + 70, maxWidth: 180, size: 14, weight: 800, color: C.slate }, measure));
    });
  }

  items.push(...sponsorStrip(input.sponsors, h - 250, false, measure));
  return { width: W, height: h, safe: SAFE_STORY, items };
}

// =====================================================================
// 3) Hikaye C: MVP + skor (1080x1920)
// =====================================================================
export interface MvpInput { name: string; number: number | string; position: string; photo?: CanvasImageSource | null }

export interface StoryCInput {
  home: string;
  away: string;
  group?: string;
  score?: { home: number; away: number } | null;
  mvp?: MvpInput | null;
  sponsors?: SponsorInput[];
  crest?: CanvasImageSource | null;
}

export function layoutStoryC(input: StoryCInput, measure: Measure): PosterLayout {
  const h = 1920;
  const items: PosterItem[] = [background(W, h), ...framed(h)];
  items.push(clubCrest('crest', W / 2, 300, 140, '#0a5c3d', input.crest));

  const hasScore = !!input.score && Number.isInteger(input.score.home) && Number.isInteger(input.score.away);
  if (hasScore && input.score) {
    items.push(fitText({ role: 'result-label', text: 'MAÇ SONUCU', x: W / 2, y: 560, maxWidth: 900, size: 34, weight: 900, color: C.goldLight }, measure));
    items.push(fitText({ role: 'score', text: `${input.score.home} — ${input.score.away}`, x: W / 2, y: 710, maxWidth: 900, size: 130, minSize: 60, weight: 900, color: '#ffffff' }, measure));
  }
  const teamsY = hasScore ? 790 : 620;
  items.push(fitText({ role: 'teams', text: `${input.home} vs ${input.away}`, x: W / 2, y: teamsY, maxWidth: 940, size: 42, minSize: 20, weight: 800, color: C.bright, upper: true }, measure));
  const group = input.group?.trim();
  if (group) {
    items.push(fitText({ role: 'group', text: group, x: W / 2, y: teamsY + 56, maxWidth: 900, size: 28, minSize: 16, weight: 700, color: C.gold, upper: true }, measure));
  }

  const mvp = input.mvp;
  if (mvp) {
    const cardY = hasScore ? 940 : 780;
    items.push({ kind: 'rect', role: 'mvp-card', x: 110, y: cardY, w: W - 220, h: 420, radius: 28, fill: 'rgba(13, 37, 26, 0.9)', stroke: '#eab308', strokeWidth: 3 });
    items.push(fitText({ role: 'mvp-label', text: '★ MAÇIN OYUNCUSU (MVP)', x: W / 2, y: cardY + 60, maxWidth: 780, size: 26, minSize: 14, weight: 900, color: C.goldLight }, measure));
    const cy = cardY + 170;
    if (mvp.photo) {
      items.push({ kind: 'image', role: 'mvp-photo', image: mvp.photo, x: W / 2 - 90, y: cy - 90, w: 180, h: 180, shape: 'circle', alpha: 1 });
      items.push({ kind: 'circle', role: 'mvp-avatar-ring', cx: W / 2, cy, r: 90, stroke: '#eab308', strokeWidth: 4 });
    } else {
      items.push({ kind: 'circle', role: 'mvp-avatar', cx: W / 2, cy, r: 90, fill: '#1b2c26', stroke: '#eab308', strokeWidth: 4 });
      items.push(fitText({ role: 'mvp-avatar-number', text: String(mvp.number), x: W / 2, y: cy + 30, maxWidth: 140, size: 84, minSize: 36, weight: 900, color: C.gold }, measure));
    }
    items.push(fitText({ role: 'mvp-name', text: mvp.name, x: W / 2, y: cardY + 340, maxWidth: 780, size: 52, minSize: 24, weight: 900, color: '#ffffff', upper: true }, measure));
    const sub = [`#${mvp.number}`, mvp.position.trim()].filter(Boolean).join(' • ');
    items.push(fitText({ role: 'mvp-position', text: trUpper(sub), x: W / 2, y: cardY + 390, maxWidth: 780, size: 28, minSize: 14, weight: 600, family: FONT_BODY, color: C.slateLight }, measure));
  }

  items.push(...sponsorStrip(input.sponsors, h - 250, false, measure));
  return { width: W, height: h, safe: SAFE_STORY, items };
}

// =====================================================================
// 4) Besleme / klasik şablonlar: maç günü, haftalık program, sonuç, duyuru
//    (portrait 1080x1350 birincil; square ve story aynı motordan)
// =====================================================================
export interface FeedInput {
  format: PosterFormat;
  template: PosterTemplate;
  copy: PosterCopy;
  sponsors?: SponsorInput[];
  photo?: CanvasImageSource | null;
  crest?: CanvasImageSource | null;
}

function pillAround(role: string, text: string, y: number, color: string, measure: Measure, size: number): PosterItem[] {
  const textItem = fitText({ role: `${role}-text`, text, x: W / 2, y: y + 29, maxWidth: 900, size, minSize: 12, weight: 800, color }, measure);
  const pw = Math.min(960, textItem.box.w + 70);
  return [
    { kind: 'rect', role, x: W / 2 - pw / 2, y, w: pw, h: 42 + (size > 22 ? 2 : 0), radius: 22, fill: 'rgba(0, 168, 89, 0.2)', stroke: 'rgba(74, 225, 118, 0.5)', strokeWidth: 2 },
    textItem,
  ];
}

export function layoutFeedPoster(input: FeedInput, measure: Measure): PosterLayout {
  const { width, height } = getPosterDimensions(input.format);
  const story = input.format === 'story';
  const square = input.format === 'square';
  const safe = story ? SAFE_STORY : SAFE_FEED;
  const top = story ? 290 : square ? 60 : 110;
  const crestY = story ? 740 : square ? 440 : 560;
  const stripY = story ? height - 250 : height - 200;
  const d = input.copy.details;
  const sponsors = normalizeSponsors(input.sponsors);

  const items: PosterItem[] = [background(width, height)];
  if (input.photo) {
    items.push({ kind: 'image', role: 'photo', image: input.photo, x: 0, y: 0, w: width, h: height, shape: 'rect', alpha: 1, overlay: 'rgba(8, 16, 13, 0.68)' });
  }
  items.push(...framed(height));

  const heading = (text: string, y: number, size: number): TextItem =>
    fitText({ role: 'headline', text, x: W / 2, y, maxWidth: 920, size, minSize: 40, weight: 900, color: '#ffffff', upper: true }, measure);
  const subtitle = (text: string, y: number): TextItem =>
    fitText({ role: 'subtitle', text, x: W / 2, y, maxWidth: 920, size: 30, minSize: 16, weight: 800, color: C.gold, upper: true }, measure);

  const t = input.template;
  if (t === 'matchday' || t === 'result') {
    items.push(...pillAround('league-pill', 'RESMÎ LİG MÜSABAKASI', top, C.bright, measure, 22));
    items.push(heading(input.copy.headline, top + 140, 84));
    items.push(subtitle(input.copy.subtitle, top + 195));
  }

  if (t === 'matchday') {
    const [home = '', , away = '', , date = '', time = '', venue = ''] = d;
    const sides: Array<[number, string, string]> = [[270, home, 'EV SAHİBİ'], [810, away, 'DEPLASMAN']];
    for (const [cx, name, label] of sides) {
      const club = trUpper(name).includes('DARICA GÜCÜ');
      items.push(club
        ? clubCrest('crest', cx, crestY, 80, '#0a5c3d', input.crest)
        : { kind: 'shield', role: 'crest', cx, cy: crestY, r: 80, color: '#334155', monogram: '' });
      items.push(fitText({ role: 'team', text: name, x: cx, y: crestY + 162, maxWidth: 420, size: 34, minSize: 16, weight: 900, color: club ? C.bright : '#ffffff', upper: true }, measure));
      items.push(fitText({ role: 'team-label', text: label, x: cx, y: crestY + 198, maxWidth: 420, size: 20, minSize: 12, weight: 600, family: FONT_BODY, color: C.slate }, measure));
    }
    items.push({ kind: 'circle', role: 'vs-circle', cx: W / 2, cy: crestY, r: 48, fill: C.gold });
    items.push(fitText({ role: 'vs', text: 'VS', x: W / 2, y: crestY + 12, maxWidth: 80, size: 34, weight: 900, color: C.pitch950 }, measure));
    if (time) items.push(fitText({ role: 'time', text: time, x: W / 2, y: crestY + 95, maxWidth: 200, size: 28, minSize: 14, weight: 800, color: C.goldLight }, measure));
    items.push({ kind: 'rect', role: 'date-card', x: 190, y: crestY + 215, w: 700, h: 120, radius: 18, fill: 'rgba(8, 16, 13, 0.88)', stroke: 'rgba(74, 225, 118, 0.4)', strokeWidth: 3 });
    items.push(fitText({ role: 'date', text: date, x: W / 2, y: crestY + 265, maxWidth: 650, size: 30, minSize: 16, weight: 800, color: '#ffffff' }, measure));
    items.push(fitText({ role: 'venue', text: venue, x: W / 2, y: crestY + 307, maxWidth: 650, size: 24, minSize: 13, weight: 600, family: FONT_BODY, color: C.gold }, measure));
    items.push(...pillAround('invite-pill', 'TÜM SPORSEVERLER VE VELİLERİMİZ DAVETLİDİR', stripY - 95, C.bright, measure, 20));
  } else if (t === 'result') {
    const [home = '', scoreText = '', away = '', group = ''] = d;
    items.push(fitText({ role: 'score', text: scoreText, x: W / 2, y: crestY + 60, maxWidth: 900, size: 130, minSize: 60, weight: 900, color: '#ffffff' }, measure));
    items.push(fitText({ role: 'teams', text: `${home} vs ${away}`, x: W / 2, y: crestY + 150, maxWidth: 940, size: 42, minSize: 18, weight: 800, color: C.bright, upper: true }, measure));
    if (group && trUpper(group) !== trUpper(input.copy.subtitle)) items.push(fitText({ role: 'group', text: group, x: W / 2, y: crestY + 210, maxWidth: 900, size: 28, minSize: 16, weight: 700, color: C.gold, upper: true }, measure));
  } else if (t === 'weekly-program') {
    const compact = square;
    if (!compact) items.push(clubCrest('crest', W / 2, top + 60, 60, '#0a5c3d', input.crest));
    const base = compact ? top : top + 150;
    items.push(fitText({ role: 'brand', text: 'DARICA GÜCÜ SK', x: W / 2, y: base + (compact ? 70 : 60), maxWidth: 920, size: 56, minSize: 30, weight: 900, color: '#ffffff' }, measure));
    items.push(fitText({ role: 'headline', text: input.copy.headline, x: W / 2, y: base + (compact ? 118 : 110), maxWidth: 920, size: 30, minSize: 16, weight: 900, color: C.bright, upper: true }, measure));
    items.push(fitText({ role: 'subtitle', text: input.copy.subtitle, x: W / 2, y: base + (compact ? 156 : 150), maxWidth: 920, size: 24, minSize: 14, weight: 500, family: FONT_BODY, color: C.slate }, measure));
    const rowsTop = base + (compact ? 190 : 190);
    const limit = Math.min(stripY - 30, height - 120);
    const rows = d.slice(0, 7);
    const gap = 10;
    const rowH = Math.min(130, Math.max(60, (limit - rowsTop) / Math.max(1, rows.length) - gap));
    rows.forEach((line, index) => {
      const [when = '', matchup = '', venue = ''] = line.split(/\s+\|\s+/);
      const [date = when, time = ''] = when.split(/\s+·\s+/);
      const y = rowsTop + index * (rowH + gap);
      items.push({ kind: 'rect', role: 'row', x: 70, y, w: 940, h: rowH, radius: 18, fill: 'rgba(8, 16, 13, 0.85)', stroke: 'rgba(0, 168, 89, 0.3)', strokeWidth: 2 });
      items.push(fitText({ role: 'row-match', text: matchup, x: 98, y: y + rowH * 0.45, maxWidth: 620, size: Math.min(30, Math.round(rowH * 0.3)), minSize: 12, weight: 800, color: '#ffffff', align: 'left' }, measure));
      items.push(fitText({ role: 'row-venue', text: venue, x: 98, y: y + rowH * 0.78, maxWidth: 620, size: Math.min(22, Math.round(rowH * 0.22)), minSize: 10, weight: 500, family: FONT_BODY, color: C.slate, align: 'left' }, measure));
      if (time) items.push(fitText({ role: 'row-time', text: time, x: 982, y: y + rowH * 0.48, maxWidth: 230, size: Math.min(34, Math.round(rowH * 0.34)), minSize: 14, weight: 900, color: C.bright, align: 'right' }, measure));
      items.push(fitText({ role: 'row-date', text: date, x: 982, y: y + rowH * 0.8, maxWidth: 230, size: Math.min(20, Math.round(rowH * 0.2)), minSize: 10, weight: 500, family: FONT_BODY, color: C.slateLight, align: 'right' }, measure));
    });
  } else {
    items.push(...pillAround('brand-pill', 'DARICA GÜCÜ SPOR KULÜBÜ', top, C.bright, measure, 22));
    items.push(clubCrest('crest', W / 2, crestY - 70, 100, '#0a5c3d', input.crest));
    const lines = wrapText({ role: 'headline', text: input.copy.headline, x: W / 2, y: crestY + 130, maxWidth: 900, size: 72, weight: 900, color: '#ffffff', lineHeight: 84, maxLines: 3, upper: true }, measure);
    items.push(...lines);
    const subLines = wrapText({ role: 'subtitle', text: input.copy.subtitle, x: W / 2, y: crestY + 130 + lines.length * 84 + 10, maxWidth: 900, size: 32, weight: 800, color: C.gold, lineHeight: 44, maxLines: 2, upper: true }, measure);
    items.push(...subLines);
  }

  items.push(...sponsorStrip(sponsors, stripY, !story, measure));
  if (t !== 'announcement') {
    items.push(fitText({ role: 'footer-left', text: 'ASKF ONAYLI', x: 70, y: height - 85, maxWidth: 300, size: 18, minSize: 12, weight: 700, family: FONT_BODY, color: C.mint, align: 'left', critical: !story }, measure));
  }
  items.push(fitText({ role: 'footer-right', text: '@daricagucuspor', x: 1010, y: height - 85, maxWidth: 300, size: 18, minSize: 12, weight: 700, family: FONT_BODY, color: C.mint, align: 'right', critical: !story }, measure));
  items.push(fitText({ role: 'footer-signature', text: 'KOCAELİ AMATÖR SPOR KULÜPLERİ FEDERASYONU', x: W / 2, y: height - 50, maxWidth: 900, size: 18, minSize: 11, weight: 700, family: FONT_BODY, color: C.mint, critical: !story }, measure));

  return { width, height, safe, items };
}
