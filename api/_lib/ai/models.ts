/**
 * Merkezi Claude model kaydı. Model kimliklerini değiştirmek için TEK dosya burasıdır.
 *
 * DOĞRULAMA (2026-11-15): kimlikler resmi model sayfasından okundu:
 * https://platform.claude.com/docs/en/models/overview
 * Canlı doğrulama komutu (anahtarınızla, yanıttaki `line` alanı sınıfı verir):
 *   curl https://api.anthropic.com/v1/models?lifecycle=active \
 *     -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"
 * Çalışma zamanında `verifyModelIds()` aynı listeyi çekip kayıttaki kimlikleri
 * karşılaştırır; doğrulanamayan kimlik kullanılmaz (bkz. service.ts).
 *
 * FİYAT NOTU: Opus 5.5 = $4/$20, Sonnet 5.5 = $2/$10 (1M token, giriş/çıkış).
 * Haiku 5.5 için sayfa yalnızca "başlangıç" fiyatı veriyor; bütçe güvenliği için
 * Haiku maliyeti Sonnet fiyatıyla (üst sınır) hesaplanır. Önbellek okuma/yazma
 * fiyatları doğrulanmadığı için bu tokenlar da giriş fiyatıyla sayılır: tahmin
 * üst sınıra yakındır ve `approximate: true` olarak raporlanır.
 */
export type ModelTier = 'fast' | 'balanced' | 'deep';

export interface ModelSpec {
  id: string;
  label: string;
  /** USD / 1M token */
  inputPerMTok: number;
  outputPerMTok: number;
  maxOutputTokens: number;
}

export const MODEL_REGISTRY: Record<ModelTier, ModelSpec> = {
  fast: { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', inputPerMTok: 2, outputPerMTok: 10, maxOutputTokens: 4096 },
  balanced: { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', inputPerMTok: 2, outputPerMTok: 10, maxOutputTokens: 4096 },
  deep: { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', inputPerMTok: 4, outputPerMTok: 20, maxOutputTokens: 8192 },
};

export const DEFAULT_TIER: ModelTier = 'balanced';
export const ANTHROPIC_VERSION = '2023-06-01';
export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
