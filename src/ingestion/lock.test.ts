import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FUNCTION_MAX_DURATION_SECONDS,
  LOCK_TTL_MS,
  evaluateRunLock,
  isManualCheckTooSoon,
} from './lock';

const base = Date.parse('2026-11-17T15:00:00.000Z');
const iso = (offsetSeconds: number) => new Date(base - offsetSeconds * 1000).toISOString();

describe('ASKF kontrol kilidi', () => {
  it('TTL, cron dosyasındaki maxDuration değerinden büyük ve en fazla 10 sn fazladır', () => {
    const source = readFileSync(new URL('../../api/cron-askf.ts', import.meta.url), 'utf8');
    const match = /maxDuration:\s*(\d+)/.exec(source);
    expect(match).not.toBeNull();
    const maxDuration = Number(match![1]);
    expect(maxDuration).toBe(FUNCTION_MAX_DURATION_SECONDS);
    expect(LOCK_TTL_MS).toBeGreaterThan(maxDuration * 1000);
    expect(LOCK_TTL_MS).toBeLessThanOrEqual((maxDuration + 10) * 1000);
  });

  it('running dışındaki durumlarda kilit serbesttir', () => {
    expect(evaluateRunLock(null, new Date(base))).toBe('free');
    expect(evaluateRunLock({ state: 'verified', lastAttempt: iso(1) }, new Date(base))).toBe('free');
  });

  it('TTL içinde running kilidi aktiftir', () => {
    expect(evaluateRunLock({ state: 'running', lastAttempt: iso(30) }, new Date(base))).toBe('active');
    expect(evaluateRunLock({ state: 'running', lastAttempt: iso(64) }, new Date(base))).toBe('active');
  });

  it('fonksiyon 60 sn sonra öldüyse kilit en geç 65. saniyede bırakılır', () => {
    expect(evaluateRunLock({ state: 'running', lastAttempt: iso(65) }, new Date(base))).toBe('stale');
    expect(evaluateRunLock({ state: 'running', lastAttempt: iso(120) }, new Date(base))).toBe('stale');
  });

  it('bozuk lastAttempt değeri kalıcı kilit yapmaz', () => {
    expect(evaluateRunLock({ state: 'running', lastAttempt: 'bozuk' }, new Date(base))).toBe('stale');
    expect(evaluateRunLock({ state: 'running', lastAttempt: null }, new Date(base))).toBe('stale');
  });

  it('manuel kontrol 5 dakikadan sık yapılamaz', () => {
    expect(isManualCheckTooSoon(iso(60), new Date(base))).toBe(true);
    expect(isManualCheckTooSoon(iso(301), new Date(base))).toBe(false);
    expect(isManualCheckTooSoon(null, new Date(base))).toBe(false);
  });
});
