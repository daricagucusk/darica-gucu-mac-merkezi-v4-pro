/**
 * ASKF kontrol kilidi sabitleri.
 *
 * api/cron-askf.ts içindeki `config.maxDuration` 60 saniyedir. Kilit süresi (TTL)
 * bu değerden KÜÇÜK olursa canlı bir çalışma ikiye bölünebilir; çok büyük olursa
 * Vercel fonksiyonu 60. saniyede öldürüldüğünde `running` durumu gereksiz uzun
 * "kilitli" kalır. Bu yüzden TTL, maxDuration + küçük bir tolerans olarak tek
 * yerde tutulur ve lock.test.ts bu ilişkiyi cron dosyasından okuyarak doğrular.
 */
export const FUNCTION_MAX_DURATION_SECONDS = 60;
export const LOCK_GRACE_SECONDS = 5;
export const LOCK_TTL_MS = (FUNCTION_MAX_DURATION_SECONDS + LOCK_GRACE_SECONDS) * 1000;
export const MANUAL_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export interface LockStatusLike {
  state?: string;
  lastAttempt?: string | null;
}

export type LockVerdict = 'free' | 'active' | 'stale';

/**
 * `running` durumu TTL içindeyse kilit aktiftir. TTL dolduysa önceki çalışma
 * büyük olasılıkla fonksiyon zaman aşımıyla ölmüştür: kilit "stale" sayılır ve
 * yeni kontrol başlayabilir (çağıran taraf bunu denetim kaydına yazar).
 */
export function evaluateRunLock(status: LockStatusLike | null | undefined, now: Date): LockVerdict {
  if (!status || status.state !== 'running') return 'free';
  const last = status.lastAttempt ? Date.parse(status.lastAttempt) : Number.NaN;
  if (!Number.isFinite(last)) return 'stale';
  const age = now.getTime() - last;
  if (age < 0) return 'active';
  return age < LOCK_TTL_MS ? 'active' : 'stale';
}

export function isManualCheckTooSoon(lastAttemptIso: string | null | undefined, now: Date): boolean {
  const last = lastAttemptIso ? Date.parse(lastAttemptIso) : 0;
  return Boolean(last) && now.getTime() - last < MANUAL_CHECK_INTERVAL_MS;
}
