import type { PosterCopy, PosterFormat, PosterTemplate } from './poster-utils';
import { getPosterDimensions } from './poster-utils';
import { ensurePosterFonts } from './fonts';
import { canvasMeasure, drawLayout } from './poster-draw';
import { layoutFeedPoster } from './poster-layouts';

export interface PosterRenderInput {
  format: PosterFormat;
  template: PosterTemplate;
  copy: PosterCopy;
  photo?: CanvasImageSource | null;
  /** Boş/undefined ise alt sponsor şeridi çizilmez. */
  sponsors?: string[];
}

/** Mevcut API: maç günü / haftalık / sonuç / duyuru, Stitch görünümünde (yerleşim poster-layouts.ts). */
export async function renderPoster(canvas: HTMLCanvasElement, input: PosterRenderInput): Promise<void> {
  await ensurePosterFonts();
  const { width, height } = getPosterDimensions(input.format);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Afiş tuvali oluşturulamadı.');
  const layout = layoutFeedPoster(input, canvasMeasure(ctx));
  drawLayout(ctx, layout);
}
