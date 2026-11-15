import { describe, expect, it } from 'vitest';
import {
  layoutFeedPoster, layoutShortsCover, layoutStoryA, layoutStoryC,
  type ImageItem, type PosterLayout, type ShieldItem,
} from './poster-layouts';
import type { Measure } from './poster-text';
import { buildPosterCopy, type PosterFixture } from './poster-utils';

const measure: Measure = (text, font) => Array.from(text).length * Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16) * 0.75;
const crest = { width: 512, height: 512 } as unknown as CanvasImageSource;

const fixture: PosterFixture = {
  id: 'f1', group: 'U14', date: '2026-11-21', time: '14:30', home: 'Darıca Gücü SK', away: 'Çayırova Serhat Spor',
  venue: 'Nenehatun Stadı', status: 'scheduled',
};
const copy = buildPosterCopy({ template: 'matchday', fixture, verified: true });
const imageCrests = (l: PosterLayout): ImageItem[] =>
  l.items.filter((i): i is ImageItem => i.kind === 'image' && i.role === 'crest');
const shieldCrests = (l: PosterLayout): ShieldItem[] =>
  l.items.filter((i): i is ShieldItem => i.kind === 'shield' && i.role === 'crest');

describe('isteğe bağlı kulüp arması', () => {
  const build = (c?: CanvasImageSource): PosterLayout[] => [
    layoutShortsCover({ theme: 'club-emerald', hook: 'Kapışma', badge: 'ROZET', home: 'A', away: 'B', crest: c }, measure),
    layoutStoryA({ group: 'U14', home: 'A', away: 'B', date: '21 Kasım', time: '14:30', venue: 'Saha', crest: c }, measure),
    layoutStoryC({ home: 'A', away: 'B', crest: c }, measure),
    layoutFeedPoster({ format: 'portrait', template: 'matchday', copy, crest: c }, measure),
  ];

  it('crest yoksa çizilen kalkan kullanılır (eski davranış)', () => {
    for (const l of build()) {
      expect(imageCrests(l)).toHaveLength(0);
      expect(shieldCrests(l).length).toBeGreaterThan(0);
    }
  });

  it('crest verilince kulüp kalkanı kırpmadan sığdırılan görselle değişir', () => {
    for (const l of build(crest)) {
      const imgs = imageCrests(l);
      expect(imgs).toHaveLength(1);
      expect(imgs[0].fit).toBe('contain');
      expect(imgs[0].w).toBe(imgs[0].h);
      // Arma şeffaf PNG: beyaz zemin yok; Stitch karosu koyu zemin + yeşil çerçeve ile çizilir.
      expect(imgs[0].fill).toMatch(/^rgba\(6, 16, 12/);
      expect(imgs[0].stroke).toContain('74, 225, 118');
      expect(imgs[0].inset ?? 0).toBeGreaterThan(0);
    }
  });

  it('maç gününde rakip kalkanı çizili kalır', () => {
    const feed = build(crest)[3];
    expect(shieldCrests(feed)).toHaveLength(1);
    expect(shieldCrests(feed)[0].monogram).toBe('');
  });
});

describe('Hikaye C skor kuralı', () => {
  it('skor girilmediyse skor ve sonuç etiketi öğesi çizilmez', () => {
    const layout = layoutStoryC({ home: 'A', away: 'B', score: null }, measure);
    expect(layout.items.some((i) => i.role === 'score' || i.role === 'result-label')).toBe(false);
  });
  it('skor girilince yalnız girilen değer çizilir', () => {
    const layout = layoutStoryC({ home: 'A', away: 'B', score: { home: 4, away: 2 } }, measure);
    const score = layout.items.find((i) => i.role === 'score');
    expect(score && score.kind === 'text' ? score.text : '').toBe('4 — 2');
  });
});
