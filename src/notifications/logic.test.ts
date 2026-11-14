import { describe, expect, it } from 'vitest';
import { buildMatchReminderKey, isWithinReminderWindow, isDuplicateNotification, shouldRemindFixture } from './logic';

describe('notification logic', () => {
  it('creates a stable dedupe key for the same fixture occurrence', () => {
    const a = buildMatchReminderKey({
      season: '2026-2027',
      fixtureId: 'fixture-1',
      date: '2026-11-16',
      time: '19:00',
    });
    const b = buildMatchReminderKey({
      season: '2026-2027',
      fixtureId: 'fixture-1',
      date: '2026-11-16',
      time: '19:00',
    });
    const changed = buildMatchReminderKey({
      season: '2026-2027',
      fixtureId: 'fixture-1',
      date: '2026-11-16',
      time: '20:00',
    });

    expect(a).toBe(b);
    expect(a).not.toBe(changed);
  });

  it('prevents duplicate notifications with the same persisted key', () => {
    expect(isDuplicateNotification(['match-reminder:a', 'askf-pending:b'], 'match-reminder:a')).toBe(true);
    expect(isDuplicateNotification(['match-reminder:a'], 'match-reminder:b')).toBe(false);
  });

  it('reminds only scheduled fixtures inside the lead window', () => {
    const now = new Date('2026-11-15T12:00:00.000Z');
    expect(shouldRemindFixture('scheduled', '2026-11-15', '16:00', now)).toBe(true);
    expect(shouldRemindFixture('postponed', '2026-11-15', '16:00', now)).toBe(false);
    expect(shouldRemindFixture('cancelled', '2026-11-15', '16:00', now)).toBe(false);
  });

  it('includes only fixtures inside the next 30 hours', () => {
    const now = new Date('2026-11-15T12:00:00.000Z');
    expect(isWithinReminderWindow('2026-11-15', '16:00', now)).toBe(true);
    expect(isWithinReminderWindow('2026-11-16', '15:00', now)).toBe(true);
    expect(isWithinReminderWindow('2026-11-17', '20:00', now)).toBe(false);
    expect(isWithinReminderWindow('2026-11-15', '10:00', now)).toBe(false);
  });
});
