/**
 * AI'ya giden her metin bu kapıdan geçer. Kulüp/sporcu/çocuk kişisel verisi
 * dış hizmete gitmez: kapı şüpheli değer görürse çağrıyı durdurur.
 * Yalnızca takım adı, tarih, hafta, kaynak durumu ve sayaçlar gönderilir.
 */
const PATTERNS: Array<[string, RegExp]> = [
  ['tc_kimlik', /(?<!\d)[1-9]\d{10}(?!\d)/],
  ['iban', /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i],
  ['telefon', /(?<!\d)(?:\+?90|0)?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/],
  ['eposta', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/],
  ['anahtar', /\b(?:sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,})/],
];

const SENSITIVE_WORDS = /\b(sporcu|oyuncu adı|veli|lisans no|doğum|sağlık|sakatlık|kimlik no)\b/i;

export class PrivacyGateError extends Error {
  constructor(public readonly reason: string) {
    super(`AI gizlilik kapısı: ${reason}`);
    this.name = 'PrivacyGateError';
  }
}

export function assertAiSafeText(text: string): void {
  for (const [name, pattern] of PATTERNS) {
    if (pattern.test(text)) throw new PrivacyGateError(name);
  }
  if (SENSITIVE_WORDS.test(text)) throw new PrivacyGateError('hassas_kelime');
}

export interface SafeMatchFacts {
  home: string;
  away: string;
  date?: string;
  time?: string;
  category?: string;
  venue?: string;
}

const clean = (value: unknown, max = 80): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Bilinmeyen alanları atar; yalnızca izin verilen maç alanlarını bırakır. */
export function toSafeMatchFacts(raw: Record<string, unknown>): SafeMatchFacts {
  return {
    home: clean(raw.home),
    away: clean(raw.away),
    date: clean(raw.date, 20) || undefined,
    time: clean(raw.time, 10) || undefined,
    category: clean(raw.category, 20) || undefined,
    venue: clean(raw.venue, 60) || undefined,
  };
}
