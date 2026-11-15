// Şablon kataloğu: arayüz (UI) bu listeyi okuyup seçici ve girdi formunu üretir.
import { canvasMeasure, drawLayout } from './poster-draw';
import { ensurePosterFonts, type FontLoadResult } from './fonts';
import {
  SHORTS_THEMES, layoutFeedPoster, layoutShortsCover, layoutStoryA, layoutStoryC,
  type FeedInput, type PosterLayout, type ShortsInput, type StoryAInput, type StoryCInput,
} from './poster-layouts';
import type { Measure } from './poster-text';
import type { PosterFormat, PosterTemplate } from './poster-utils';

export type PosterTemplateId =
  | 'shorts-cover' | 'story-a' | 'story-c'
  | 'matchday-45' | 'weekly-program-45' | 'result-45' | 'announcement-45';

export interface PosterCatalogEntry {
  id: PosterTemplateId;
  name: string;
  width: number;
  height: number;
  aspect: '9:16' | '4:5';
  /** Zorunlu girdi alanları (her şablonda ayrıca isteğe bağlı: sponsors). */
  requires: readonly string[];
  optional: readonly string[];
  themes?: ReadonlyArray<{ id: string; name: string; accent: string }>;
}

export const POSTER_CATALOG: readonly PosterCatalogEntry[] = [
  {
    id: 'shorts-cover', name: 'Shorts / Reels Kapak', width: 1080, height: 1920, aspect: '9:16',
    requires: ['theme', 'hook', 'badge', 'home', 'away'],
    optional: ['subtitle', 'cta', 'handle', 'background', 'sponsors'],
    themes: Object.values(SHORTS_THEMES).map((t) => ({ id: t.id, name: t.name, accent: t.accent })),
  },
  {
    id: 'story-a', name: 'Hikaye A: Split + Geri Sayım + Hava', width: 1080, height: 1920, aspect: '9:16',
    requires: ['group', 'home', 'away', 'date', 'time', 'venue'],
    optional: ['title', 'countdown', 'weather', 'photo', 'sponsors'],
  },
  {
    id: 'story-c', name: 'Hikaye C: MVP + Skor', width: 1080, height: 1920, aspect: '9:16',
    requires: ['home', 'away'],
    optional: ['group', 'score', 'mvp', 'sponsors'],
  },
  { id: 'matchday-45', name: 'Maç Günü (4:5)', width: 1080, height: 1350, aspect: '4:5', requires: ['copy'], optional: ['photo', 'sponsors'] },
  { id: 'weekly-program-45', name: 'Haftalık Program (4:5)', width: 1080, height: 1350, aspect: '4:5', requires: ['copy'], optional: ['photo', 'sponsors'] },
  { id: 'result-45', name: 'Sonuç (4:5)', width: 1080, height: 1350, aspect: '4:5', requires: ['copy'], optional: ['photo', 'sponsors'] },
  { id: 'announcement-45', name: 'Duyuru (4:5)', width: 1080, height: 1350, aspect: '4:5', requires: ['copy'], optional: ['photo', 'sponsors'] },
];

type FeedRequestInput = Omit<FeedInput, 'template' | 'format'>;

export type PosterTemplateRequest =
  | { id: 'shorts-cover'; input: ShortsInput }
  | { id: 'story-a'; input: StoryAInput }
  | { id: 'story-c'; input: StoryCInput }
  | { id: 'matchday-45' | 'weekly-program-45' | 'result-45' | 'announcement-45'; input: FeedRequestInput };

const FEED_TEMPLATE: Record<string, PosterTemplate> = {
  'matchday-45': 'matchday',
  'weekly-program-45': 'weekly-program',
  'result-45': 'result',
  'announcement-45': 'announcement',
};

export function layoutPosterTemplate(request: PosterTemplateRequest, measure: Measure): PosterLayout {
  switch (request.id) {
    case 'shorts-cover': return layoutShortsCover(request.input, measure);
    case 'story-a': return layoutStoryA(request.input, measure);
    case 'story-c': return layoutStoryC(request.input, measure);
    default: {
      const format: PosterFormat = 'portrait';
      return layoutFeedPoster({ ...request.input, format, template: FEED_TEMPLATE[request.id] }, measure);
    }
  }
}

export interface RenderResult { fonts: FontLoadResult; width: number; height: number }

/** Yazı tiplerini yükler (başarısız olsa da çizer, sonucu bildirir), yerleşimi hesaplar ve tuvale çizer. */
export async function renderPosterTemplate(canvas: HTMLCanvasElement, request: PosterTemplateRequest): Promise<RenderResult> {
  const fonts = await ensurePosterFonts();
  const probe = canvas.getContext('2d');
  if (!probe) throw new Error('Afiş tuvali oluşturulamadı.');
  const layout = layoutPosterTemplate(request, canvasMeasure(probe));
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Afiş tuvali oluşturulamadı.');
  drawLayout(ctx, layout);
  return { fonts, width: layout.width, height: layout.height };
}
