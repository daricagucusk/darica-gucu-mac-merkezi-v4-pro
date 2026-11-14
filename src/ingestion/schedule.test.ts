import { describe, expect, it } from 'vitest';
import { defaultAskfMonitorSettings, shouldRunScheduledCheck } from './schedule';

describe('ASKF scheduled check preferences', () => {
  it('runs daily mode on every cron day', () => {
    expect(shouldRunScheduledCheck({ ...defaultAskfMonitorSettings, frequency: 'daily' }, new Date('2026-11-16T15:00:00.000Z'))).toBe(true);
    expect(shouldRunScheduledCheck({ ...defaultAskfMonitorSettings, frequency: 'daily' }, new Date('2026-11-17T15:00:00.000Z'))).toBe(true);
  });

  it('runs weekly mode only on Tuesday in Istanbul time', () => {
    expect(shouldRunScheduledCheck(defaultAskfMonitorSettings, new Date('2026-11-17T15:00:00.000Z'))).toBe(true);
    expect(shouldRunScheduledCheck(defaultAskfMonitorSettings, new Date('2026-11-16T15:00:00.000Z'))).toBe(false);
    expect(shouldRunScheduledCheck(defaultAskfMonitorSettings, new Date('2026-11-18T15:00:00.000Z'))).toBe(false);
  });

  it('uses Istanbul calendar day around UTC date boundaries', () => {
    expect(shouldRunScheduledCheck(defaultAskfMonitorSettings, new Date('2026-11-16T21:30:00.000Z'))).toBe(true);
    expect(shouldRunScheduledCheck(defaultAskfMonitorSettings, new Date('2026-11-17T21:30:00.000Z'))).toBe(false);
  });
});
