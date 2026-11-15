import { describe, expect, it } from 'vitest';
import { layoutShortsCover, SHORTS_THEMES, type PosterItem, type PosterLayout, type ShortsThemeId } from './poster-layouts';
import type { Measure } from './poster-text';

const measure: Measure = (text, font) => Array.from(text).length * Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16) * 0.75;
const crest = { width: 512, height: 512 } as unknown as CanvasImageSource;

interface Box { role: string; x: number; y: number; w: number; h: number }
function boxOf(item: PosterItem): Box | null {
  switch (item.kind) {
    case 'text': return { role: item.role, ...item.box };
    case 'rect': case 'image': return { role: item.role, x: item.x, y: item.y, w: item.w, h: item.h };
    case 'shield': return { role: item.role, x: item.cx - item.r, y: item.cy - item.r, w: item.r * 2, h: item.r * 2.3 };
    default: return null;
  }
}
const GROUPS = ['badge-pill', 'crest', 'hook', 'subtitle', 'vs-card', 'cta-pill'];
const inGroup = (b: Box): boolean => GROUPS.includes(b.role);
const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function main(layout: PosterLayout): Box[] {
  return layout.items.map(boxOf).filter((b): b is Box => !!b && inGroup(b));
}

describe('Shorts kapak: öğe çakışması ve güvenli alan', () => {
  const themes = Object.keys(SHORTS_THEMES) as ShortsThemeId[];
  const cases = themes.flatMap((theme) => [undefined, crest].flatMap((c) => [
    { theme, c, hook: 'Kısa', subtitle: '' },
    { theme, c, hook: 'Şampiyonluk yolunda çok uzun bir kapak başlığı ğüşöçıİ', subtitle: 'Alt başlık' },
  ]));

  for (const k of cases) {
    it(`${k.theme} crest=${k.c ? 'var' : 'yok'} hook=${k.hook.length}: öğeler binmez, güvenli alanda`, () => {
      const layout = layoutShortsCover({ theme: k.theme, hook: k.hook, subtitle: k.subtitle, badge: 'MAÇ GÜNÜ', home: 'Darıca Gücü SK', away: 'Çok Uzun Takım Adı Gençlik ve Spor Kulübü', crest: k.c }, measure);
      const boxes = main(layout);
      for (const role of ['badge-pill', 'crest', 'hook', 'vs-card', 'cta-pill']) expect(boxes.some((b) => b.role === role), role).toBe(true);
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          if (boxes[i].role === boxes[j].role) continue;
          expect(overlap(boxes[i], boxes[j]), `${boxes[i].role} x ${boxes[j].role}`).toBe(false);
        }
      }
      for (const b of boxes) {
        expect(b.y, `${b.role} güvenli üst`).toBeGreaterThanOrEqual(layout.safe.top);
        expect(b.y + b.h, `${b.role} güvenli alt`).toBeLessThanOrEqual(layout.height - layout.safe.bottom);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(layout.width);
      }
      const pill = boxes.find((b) => b.role === 'badge-pill')!;
      const crestBox = boxes.find((b) => b.role === 'crest')!;
      expect(crestBox.y - (pill.y + pill.h), 'rozet-arma boşluğu').toBeGreaterThanOrEqual(24);
    });
  }
});
