import { describe, expect, it } from 'vitest';
import { POSTER_FONT_FACES, TURKISH_SAMPLE, ensurePosterFonts } from './fonts';

describe('ensurePosterFonts', () => {
  it('tüm Chivo/Inter yüzleri Türkçe örnek metinle yüklenir', async () => {
    const calls: Array<[string, string | undefined]> = [];
    const result = await ensurePosterFonts({
      load: async (font, text) => { calls.push([font, text]); return [{}]; },
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(calls).toHaveLength(POSTER_FONT_FACES.length);
    expect(calls.every(([, text]) => text === TURKISH_SAMPLE)).toBe(true);
    expect(POSTER_FONT_FACES.some((f) => f.includes('Chivo'))).toBe(true);
    expect(POSTER_FONT_FACES.some((f) => f.includes('Inter'))).toBe(true);
  });

  it('eşleşen yüz yoksa (boş dizi) başarısızlığı bildirir, fırlatmaz', async () => {
    const result = await ensurePosterFonts({ load: async () => [] });
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(POSTER_FONT_FACES.length);
  });

  it('load reddederse veya font API yoksa yine sonuç döner', async () => {
    const rejected = await ensurePosterFonts({ load: async () => { throw new Error('ağ'); } });
    expect(rejected.ok).toBe(false);
    const none = await ensurePosterFonts(null);
    expect(none.ok).toBe(false);
    expect(none.loaded).toEqual([]);
  });
});
