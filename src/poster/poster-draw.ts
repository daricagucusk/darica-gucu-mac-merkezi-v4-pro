// İnce çizim katmanı: PosterLayout -> CanvasRenderingContext2D. Karar mantığı yoktur.
import type { Measure } from './poster-text';
import type { ImageItem, PosterItem, PosterLayout, ShieldItem } from './poster-layouts';

export function canvasMeasure(ctx: CanvasRenderingContext2D): Measure {
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

function drawShield(ctx: CanvasRenderingContext2D, s: ShieldItem): void {
  const r = s.r;
  ctx.save();
  ctx.translate(s.cx, s.cy);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r, -r * 0.9, r, 0);
  ctx.quadraticCurveTo(r, r * 0.8, 0, r * 1.3);
  ctx.quadraticCurveTo(-r, r * 0.8, -r, 0);
  ctx.quadraticCurveTo(-r, -r * 0.9, 0, -r);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, s.color);
  grad.addColorStop(1, '#020a06');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.stroke();
  if (s.monogram) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(r * 0.75)}px Chivo, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.monogram, 0, 5);
  }
  ctx.restore();
}

function drawImageItem(ctx: CanvasRenderingContext2D, item: ImageItem): void {
  const src = item.image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const iw = src.naturalWidth ?? src.width ?? item.w;
  const ih = src.naturalHeight ?? src.height ?? item.h;
  if (item.fit === 'contain') {
    const k = Math.min(item.w / iw, item.h / ih);
    const dw = iw * k;
    const dh = ih * k;
    ctx.save();
    if (item.radius) {
      ctx.beginPath();
      ctx.roundRect(item.x, item.y, item.w, item.h, item.radius);
      ctx.clip();
    }
    ctx.globalAlpha = item.alpha;
    ctx.drawImage(item.image, item.x + (item.w - dw) / 2, item.y + (item.h - dh) / 2, dw, dh);
    ctx.restore();
    if (item.radius && item.stroke) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(item.x, item.y, item.w, item.h, item.radius);
      ctx.strokeStyle = item.stroke;
      ctx.lineWidth = item.strokeWidth ?? 3;
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  const scale = Math.max(item.w / iw, item.h / ih);
  const cw = item.w / scale;
  const ch = item.h / scale;
  ctx.save();
  ctx.beginPath();
  if (item.shape === 'circle') ctx.arc(item.x + item.w / 2, item.y + item.h / 2, item.w / 2, 0, Math.PI * 2);
  else ctx.rect(item.x, item.y, item.w, item.h);
  ctx.clip();
  ctx.globalAlpha = item.alpha;
  ctx.drawImage(item.image, (iw - cw) / 2, (ih - ch) / 2, cw, ch, item.x, item.y, item.w, item.h);
  ctx.globalAlpha = 1;
  if (item.overlay) {
    ctx.fillStyle = item.overlay;
    ctx.fillRect(item.x, item.y, item.w, item.h);
  }
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, item: PosterItem, layout: PosterLayout): void {
  switch (item.kind) {
    case 'bg': {
      const grad = item.mode === 'linear'
        ? ctx.createLinearGradient(item.x0, item.y0, item.x1, item.y1)
        : ctx.createRadialGradient(item.x0, item.y0, item.r0, item.x1, item.y1, item.r1);
      for (const [offset, color] of item.stops) grad.addColorStop(offset, color);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, layout.width, layout.height);
      return;
    }
    case 'rect':
      ctx.beginPath();
      if (item.radius > 0) ctx.roundRect(item.x, item.y, item.w, item.h, item.radius);
      else ctx.rect(item.x, item.y, item.w, item.h);
      if (item.fill) { ctx.fillStyle = item.fill; ctx.fill(); }
      if (item.stroke) { ctx.strokeStyle = item.stroke; ctx.lineWidth = item.strokeWidth ?? 2; ctx.stroke(); }
      return;
    case 'circle':
      ctx.beginPath();
      ctx.arc(item.cx, item.cy, item.r, 0, Math.PI * 2);
      if (item.fill) { ctx.fillStyle = item.fill; ctx.fill(); }
      if (item.stroke) { ctx.strokeStyle = item.stroke; ctx.lineWidth = item.strokeWidth ?? 2; ctx.stroke(); }
      return;
    case 'shield':
      drawShield(ctx, item);
      return;
    case 'image':
      drawImageItem(ctx, item);
      return;
    case 'text':
      ctx.save();
      ctx.font = item.font;
      ctx.fillStyle = item.color;
      ctx.textAlign = item.align;
      ctx.textBaseline = 'alphabetic';
      if (item.shadow) { ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'; ctx.shadowBlur = 18; }
      // maxWidth: gerçek ölçü testteki tahminden büyükse son çare olarak sıkıştırır.
      ctx.fillText(item.text, item.x, item.y, item.maxWidth);
      ctx.restore();
  }
}

export function drawLayout(ctx: CanvasRenderingContext2D, layout: PosterLayout): void {
  for (const item of layout.items) drawItem(ctx, item, layout);
}
