import { describe, expect, it } from 'vitest';
import { buildDashboardMetrics, type DashboardMatch } from './metrics';

const fixture = (overrides: Partial<DashboardMatch> = {}): DashboardMatch => ({
  id: 'fixture-1',
  group: 'U14',
  date: '2026-11-16',
  time: '19:00',
  home: 'Darıca Gücü Spor',
  away: 'Gebze Spor',
  venue: 'Darıca Nenehatun Stadı',
  status: 'scheduled',
  ...overrides,
});

describe('buildDashboardMetrics', () => {
  it('derives verified fixture totals and category distribution without mutating inputs', () => {
    const matches = [
      fixture(),
      fixture({ id: 'fixture-2', group: 'U15', home: 'Başiskele Spor' }),
      fixture({ id: 'fixture-3', group: 'U14', status: 'postponed' }),
    ];
    const original = structuredClone(matches);
    const metrics = buildDashboardMetrics({
      matches,
      daricaMatches: [matches[0]],
      trackedClubCount: 4,
      changes: [{ fixtureId: 'fixture-2', type: 'added' }],
      now: new Date('2026-11-15T12:00:00.000Z'),
      sourceState: 'verified',
      freshness: 'current',
    });

    expect(metrics.fixtureCount).toBe(3);
    expect(metrics.daricaFixtureCount).toBe(1);
    expect(metrics.trackedClubCount).toBe(4);
    expect(metrics.categoryCounts).toEqual([
      { category: 'U14', count: 2 },
      { category: 'U15', count: 1 },
    ]);
    expect(metrics.changeCount).toBe(1);
    expect(matches).toEqual(original);
  });

  it('selects only future scheduled matches as upcoming', () => {
    const matches = [
      fixture({ id: 'past', date: '2026-11-15', time: '10:00' }),
      fixture({ id: 'postponed', date: '2026-11-16', time: '17:00', status: 'postponed' }),
      fixture({ id: 'next', date: '2026-11-16', time: '19:00' }),
      fixture({ id: 'later', date: '2026-11-17', time: '18:00' }),
    ];
    const metrics = buildDashboardMetrics({
      matches,
      daricaMatches: matches,
      trackedClubCount: 1,
      changes: [],
      now: new Date('2026-11-16T13:00:00.000Z'),
      sourceState: 'verified',
      freshness: 'current',
    });

    expect(metrics.upcomingCount).toBe(2);
    expect(metrics.nextMatch?.id).toBe('next');
  });

  it('marks stale or unverified data clearly and keeps empty counts at zero', () => {
    const metrics = buildDashboardMetrics({
      matches: [],
      daricaMatches: [],
      trackedClubCount: 0,
      changes: [],
      now: new Date('2026-11-15T12:00:00.000Z'),
      sourceState: 'refresh_failed',
      freshness: 'stale',
    });

    expect(metrics.fixtureCount).toBe(0);
    expect(metrics.upcomingCount).toBe(0);
    expect(metrics.nextMatch).toBeNull();
    expect(metrics.sourceLabel).toContain('ESKİ');
  });
});
