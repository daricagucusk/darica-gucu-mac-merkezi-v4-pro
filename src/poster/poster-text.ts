// Saf yerleşim yardımcıları: canvas yok. measure(text, font) dışarıdan enjekte edilir.

export type Measure = (text: string, font: string) => number;

export interface Box { x: number; y: number; w: number; h: number }

export const FONT_HEAD = 'Chivo, sans-serif';
export const FONT_BODY = 'Inter, sans-serif';

export type Align = 'left' | 'center' | 'right';

export interface TextItem {
  kind: 'text';
  role: string;
  text: string;
  x: number;
  /** alphabetic taban çizgisi */
  y: number;
  font: string;
  size: number;
  color: string;
  align: Align;
  /** Hesaplanan çizim kutusu (ölçüme göre). */
  box: Box;
  maxWidth: number;
  /** false: arayüz güvenli alanı dışında kalabilen, kritik olmayan süs metni. */
  critical: boolean;
  shadow?: boolean;
}

export function trUpper(value: string): string {
  return value.toLocaleUpperCase('tr-TR');
}

export function fontString(weight: number | string, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

export function ellipsize(text: string, font: string, maxWidth: number, measure: Measure): string {
  if (measure(text, font) <= maxWidth) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${chars.slice(0, mid).join('').trimEnd()}…`;
    if (measure(candidate, font) <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return lo === 0 ? '…' : `${chars.slice(0, lo).join('').trimEnd()}…`;
}

export interface TextOpts {
  role: string;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  size: number;
  minSize?: number;
  weight: number | string;
  family?: string;
  color: string;
  align?: Align;
  upper?: boolean;
  critical?: boolean;
  shadow?: boolean;
}

function makeItem(o: TextOpts, text: string, size: number, measure: Measure): TextItem {
  const family = o.family ?? FONT_HEAD;
  const font = fontString(o.weight, size, family);
  const align = o.align ?? 'center';
  const width = Math.min(measure(text, font), o.maxWidth);
  const x0 = align === 'center' ? o.x - width / 2 : align === 'right' ? o.x - width : o.x;
  return {
    kind: 'text', role: o.role, text, x: o.x, y: o.y, font, size, color: o.color, align,
    box: { x: x0, y: o.y - size * 0.9, w: width, h: size * 1.2 },
    maxWidth: o.maxWidth, critical: o.critical ?? true, shadow: o.shadow,
  };
}

/** Tek satır: önce yazı boyutunu küçültür, yetmezse "…" ile kısaltır. */
export function fitText(o: TextOpts, measure: Measure): TextItem {
  const family = o.family ?? FONT_HEAD;
  const text = o.upper ? trUpper(o.text) : o.text;
  const minSize = o.minSize ?? Math.round(o.size * 0.6);
  let size = o.size;
  while (size > minSize && measure(text, fontString(o.weight, size, family)) > o.maxWidth) size -= 2;
  size = Math.max(size, Math.min(minSize, o.size));
  const font = fontString(o.weight, size, family);
  return makeItem(o, ellipsize(text, font, o.maxWidth, measure), size, measure);
}

/** Çok satır: kelime kaydırma, maxLines aşılırsa son satır "…" ile biter. */
export function wrapText(o: TextOpts & { lineHeight: number; maxLines: number }, measure: Measure): TextItem[] {
  const family = o.family ?? FONT_HEAD;
  const text = (o.upper ? trUpper(o.text) : o.text).replace(/\s+/g, ' ').trim();
  const font = fontString(o.weight, o.size, family);
  if (!text) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate, font) > o.maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  let out = lines;
  if (lines.length > o.maxLines) {
    out = lines.slice(0, o.maxLines);
    out[o.maxLines - 1] = `${out[o.maxLines - 1]} ${lines.slice(o.maxLines).join(' ')}`;
  }
  return out.map((value, index) => makeItem(
    { ...o, y: o.y + index * o.lineHeight },
    ellipsize(value, font, o.maxWidth, measure),
    o.size,
    measure,
  ));
}

export function cleanList(values: readonly string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}
