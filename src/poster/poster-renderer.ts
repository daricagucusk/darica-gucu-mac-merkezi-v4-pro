import type { PosterCopy, PosterFormat, PosterTemplate } from './poster-utils';
import { getPosterDimensions } from './poster-utils';

export interface PosterRenderInput {
  format: PosterFormat;
  template: PosterTemplate;
  copy: PosterCopy;
  photo?: CanvasImageSource | null;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3): number {
  const words = text.split(/\s+/);
  let line = '';
  let lineCount = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      lineCount += 1;
      line = word;
      if (lineCount >= maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
    lineCount += 1;
  }
  return y + lineCount * lineHeight;
}

function drawFieldTexture(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = '#7CE6BC';
  ctx.lineWidth = 2;
  const centerX = width * 0.77;
  const centerY = height * 0.22;
  const radius = width * 0.28;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX - radius * 1.35, centerY);
  ctx.lineTo(centerX + radius * 1.35, centerY);
  ctx.moveTo(centerX, centerY - radius * 1.35);
  ctx.lineTo(centerX, centerY + radius * 1.35);
  ctx.stroke();
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 1;
  for (let index = 0; index < 9; index += 1) {
    const y = height * (0.1 + index * 0.11);
    ctx.beginPath();
    ctx.moveTo(width * 0.05, y);
    ctx.lineTo(width * 0.95, y - height * 0.025);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPhoto(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, x: number, y: number, w: number, h: number): void {
  const source = photo as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const imageWidth = source.naturalWidth ?? source.width ?? w;
  const imageHeight = source.naturalHeight ?? source.height ?? h;
  const scale = Math.max(w / imageWidth, h / imageHeight);
  const cropWidth = w / scale;
  const cropHeight = h / scale;
  const sx = (imageWidth - cropWidth) / 2;
  const sy = (imageHeight - cropHeight) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 26);
  ctx.clip();
  ctx.drawImage(photo, sx, sy, cropWidth, cropHeight, x, y, w, h);
  const tint = ctx.createLinearGradient(x, y, x, y + h);
  tint.addColorStop(0, 'rgba(7, 16, 29, 0.08)');
  tint.addColorStop(1, 'rgba(7, 16, 29, 0.72)');
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export async function renderPoster(canvas: HTMLCanvasElement, input: PosterRenderInput): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;
  const { width, height } = getPosterDimensions(input.format);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Afiş tuvali oluşturulamadı.');

  const margin = width * 0.082;
  const right = width - margin;
  const isStory = input.format === 'story';
  const isSquare = input.format === 'square';

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#081322');
  background.addColorStop(0.48, '#10243A');
  background.addColorStop(1, '#071C1C');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.78, height * 0.2, 4, width * 0.78, height * 0.2, width * 0.65);
  glow.addColorStop(0, 'rgba(41, 211, 145, 0.28)');
  glow.addColorStop(0.55, 'rgba(75, 200, 242, 0.07)');
  glow.addColorStop(1, 'rgba(8, 19, 34, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  drawFieldTexture(ctx, width, height);

  const photoTop = isStory ? height * 0.38 : isSquare ? height * 0.26 : height * 0.3;
  const photoHeight = isStory ? height * 0.28 : isSquare ? height * 0.25 : height * 0.24;
  if (input.photo) drawPhoto(ctx, input.photo, margin, photoTop, right - margin, photoHeight);

  const markSize = width * 0.105;
  roundedRect(ctx, margin, height * 0.055, markSize, markSize, 22, '#29D391');
  ctx.fillStyle = '#071C18';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(markSize * 0.38)}px Satoshi, Arial, sans-serif`;
  ctx.fillText('DG', margin + markSize / 2, height * 0.055 + markSize / 2 + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(226, 241, 250, 0.76)';
  ctx.font = `600 ${Math.round(width * 0.021)}px "JetBrains Mono", monospace`;
  ctx.fillText('DARICA GÜCÜ SPOR KULÜBÜ', margin + markSize + width * 0.025, height * 0.055 + markSize * 0.44);
  ctx.fillStyle = '#29D391';
  ctx.font = `700 ${Math.round(width * 0.016)}px "JetBrains Mono", monospace`;
  ctx.fillText('MATCH CENTER  /  V4 PRO', margin + markSize + width * 0.025, height * 0.055 + markSize * 0.73);

  const titleY = input.photo ? photoTop - height * 0.055 : (isStory ? height * 0.36 : isSquare ? height * 0.36 : height * 0.38);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${Math.round(width * (isStory ? 0.102 : 0.092))}px Satoshi, Arial, sans-serif`;
  const titleEnd = wrapText(ctx, input.copy.headline.toLocaleUpperCase('tr-TR'), margin, titleY, right - margin, width * 0.104, 2);
  ctx.fillStyle = '#93AFC2';
  ctx.font = `600 ${Math.round(width * 0.028)}px Satoshi, Arial, sans-serif`;
  const subtitleY = titleEnd + height * 0.028;
  wrapText(ctx, input.copy.subtitle, margin, subtitleY, right - margin, width * 0.04, 2);

  let contentY = input.photo ? photoTop + photoHeight + height * 0.045 : subtitleY + height * 0.085;
  if (input.template === 'weekly-program') {
    const rows = input.copy.details.slice(0, 7);
    const cardGap = height * 0.012;
    const cardHeight = Math.min(height * 0.09, (height * 0.43 - cardGap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length));
    rows.forEach((line, index) => {
      roundedRect(ctx, margin, contentY, right - margin, cardHeight, 18, 'rgba(255,255,255,0.075)', 'rgba(255,255,255,0.13)');
      ctx.fillStyle = '#29D391';
      ctx.font = `700 ${Math.round(width * 0.024)}px "JetBrains Mono", monospace`;
      ctx.fillText(String(index + 1).padStart(2, '0'), margin + width * 0.025, contentY + cardHeight * 0.42);
      ctx.fillStyle = '#F4F8FB';
      ctx.font = `600 ${Math.round(width * 0.023)}px Satoshi, Arial, sans-serif`;
      wrapText(ctx, line, margin + width * 0.085, contentY + cardHeight * 0.43, right - margin - width * 0.12, width * 0.031, 2);
      contentY += cardHeight + cardGap;
    });
  } else if (input.template === 'matchday') {
    const home = input.copy.details[0] ?? '';
    const away = input.copy.details[2] ?? '';
    const vsY = contentY + height * 0.11;
    roundedRect(ctx, margin, contentY, right - margin, height * 0.245, 26, 'rgba(8, 18, 31, 0.66)', 'rgba(255,255,255,0.14)');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${Math.round(width * 0.047)}px Satoshi, Arial, sans-serif`;
    wrapText(ctx, home, width / 2, contentY + height * 0.075, width * 0.76, width * 0.06, 2);
    ctx.fillStyle = '#29D391';
    ctx.font = `800 ${Math.round(width * 0.034)}px "JetBrains Mono", monospace`;
    ctx.fillText('VS', width / 2, vsY);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${Math.round(width * 0.047)}px Satoshi, Arial, sans-serif`;
    wrapText(ctx, away, width / 2, contentY + height * 0.19, width * 0.76, width * 0.06, 2);
    ctx.textAlign = 'left';
    contentY += height * 0.28;
    const meta = input.copy.details.slice(3).join('   •   ');
    roundedRect(ctx, margin, contentY, right - margin, height * 0.105, 18, 'rgba(41, 211, 145, 0.13)', 'rgba(41, 211, 145, 0.3)');
    ctx.fillStyle = '#DFFBF0';
    ctx.font = `600 ${Math.round(width * 0.024)}px Satoshi, Arial, sans-serif`;
    wrapText(ctx, meta, margin + width * 0.03, contentY + height * 0.045, right - margin - width * 0.06, width * 0.034, 2);
  } else {
    roundedRect(ctx, margin, contentY, right - margin, height * 0.24, 26, 'rgba(8, 18, 31, 0.66)', 'rgba(255,255,255,0.14)');
    ctx.textAlign = 'center';
    input.copy.details.slice(0, 4).forEach((line, index) => {
      ctx.fillStyle = index === 1 ? '#29D391' : '#F4F8FB';
      ctx.font = `${index === 1 ? '900' : '700'} ${Math.round(width * (index === 1 ? 0.075 : 0.033))}px Satoshi, Arial, sans-serif`;
      ctx.fillText(line, width / 2, contentY + height * (0.055 + index * 0.055));
    });
    ctx.textAlign = 'left';
  }

  const footerY = height - height * 0.105;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(margin, footerY - height * 0.028, right - margin, 2);
  ctx.fillStyle = '#B7C9D7';
  ctx.font = `600 ${Math.round(width * 0.019)}px "JetBrains Mono", monospace`;
  ctx.fillText('KOCAELİ ASKF  ·  PROGRAM DUYURUSU', margin, footerY + height * 0.016);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#29D391';
  ctx.font = `800 ${Math.round(width * 0.022)}px Satoshi, Arial, sans-serif`;
  ctx.fillText('BİRLİKTE DAHA GÜÇLÜ', right, footerY + height * 0.056);
  ctx.textAlign = 'left';
}
