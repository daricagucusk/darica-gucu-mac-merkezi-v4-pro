// Afiş yazı tipleri (self-host, OFL): Chivo (başlık) ve Inter (gövde).
// latin-ext alt kümesi Türkçe ğ ş İ ı karakterlerini içerir; ikisi de gerekli.
import '@fontsource/chivo/latin-400.css';
import '@fontsource/chivo/latin-ext-400.css';
import '@fontsource/chivo/latin-700.css';
import '@fontsource/chivo/latin-ext-700.css';
import '@fontsource/chivo/latin-800.css';
import '@fontsource/chivo/latin-ext-800.css';
import '@fontsource/chivo/latin-900.css';
import '@fontsource/chivo/latin-ext-900.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-700.css';

export const TURKISH_SAMPLE = 'ĞÜŞİÖÇğüşıöç AaBb 0123';

export const POSTER_FONT_FACES: readonly string[] = [
  '400 32px Chivo', '700 32px Chivo', '800 32px Chivo', '900 32px Chivo',
  '400 32px Inter', '500 32px Inter', '600 32px Inter', '700 32px Inter',
];

export interface FontLoadResult {
  /** Tüm yüzler yüklendiyse true. false ise afiş yine çizilir (yedek yazı tipi). */
  ok: boolean;
  loaded: string[];
  missing: string[];
}

interface FontSetLike {
  load(font: string, text?: string): Promise<unknown[]>;
}

/** Tuval çizilmeden önce çağrılır; asla fırlatmaz. document.fonts.load eşleşme yoksa [] döndürür (reddetmez). */
export async function ensurePosterFonts(fontSet?: FontSetLike | null): Promise<FontLoadResult> {
  const set = fontSet === undefined
    ? (typeof document !== 'undefined' ? (document.fonts as unknown as FontSetLike | undefined) : undefined)
    : fontSet;
  if (!set || typeof set.load !== 'function') {
    return { ok: false, loaded: [], missing: [...POSTER_FONT_FACES] };
  }
  const loaded: string[] = [];
  const missing: string[] = [];
  await Promise.all(POSTER_FONT_FACES.map(async (face) => {
    try {
      const faces = await set.load(face, TURKISH_SAMPLE);
      (faces.length > 0 ? loaded : missing).push(face);
    } catch {
      missing.push(face);
    }
  }));
  return { ok: missing.length === 0, loaded, missing };
}
