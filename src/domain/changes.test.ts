import { describe, expect, it } from 'vitest';
import { diffFixtures, type Fixture } from './changes';

const fixture = (
  id: string,
  options: Partial<Fixture> = {},
): Fixture => ({
  id,
  home: 'Darıca Gücü Spor',
  away: 'Rakip Spor',
  group: 'U13',
  date: '2026-11-15',
  time: '18:00',
  venue: 'Darıca Nenehatun Stadı',
  ...options,
});

describe('fixture change classification', () => {
  it('reports newly added fixtures', () => {
    expect(diffFixtures([], [fixture('a')])[0]?.type).toBe('added');
  });

  it('reports kickoff and venue changes separately even when the source identity changes', () => {
    const changes = diffFixtures(
      [fixture('old-id')],
      [fixture('new-id', { time: '18:30', venue: 'Gebze Stadı' })],
    );
    expect(changes.map(change => change.type).sort()).toEqual(['kickoff_changed', 'venue_changed']);
  });

  it('does not report unchanged fixtures', () => {
    expect(diffFixtures([fixture('a')], [fixture('a')])).toEqual([]);
  });

  it('detects a team change at the same kickoff slot', () => {
    const changes = diffFixtures(
      [fixture('old-id')],
      [fixture('new-id', { home: 'Başka Spor' })],
    );
    expect(changes.map(change => change.type)).toEqual(['teams_changed']);
  });

  it('matches repeated same-pair fixtures by nearest kickoff', () => {
    const previous = [
      fixture('old-1', { date: '2026-11-14', group: 'U17' }),
      fixture('old-2', { date: '2026-11-17', group: 'U17' }),
    ];
    const incoming = [
      fixture('new-1', { date: '2026-11-15', group: 'U17' }),
      fixture('new-2', { date: '2026-11-18', group: 'U17' }),
    ];
    const changes = diffFixtures(previous, incoming);
    expect(changes.filter(change => change.type === 'kickoff_changed')).toHaveLength(2);
    expect(changes.some(change => change.type === 'missing' || change.type === 'added')).toBe(false);
  });

  it('leaves an unmatched repeated fixture in verification-required state', () => {
    const previous = [
      fixture('old-1', { date: '2026-11-14', group: 'U17' }),
      fixture('old-2', { date: '2026-11-17', group: 'U17' }),
    ];
    const incoming = [fixture('new-1', { date: '2026-11-15', group: 'U17' })];
    const changes = diffFixtures(previous, incoming);
    const missing = changes.filter(change => change.type === 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].status).toBe('verification_required');
  });

  it('does not guess when repeated fixtures have equally close matches', () => {
    const previous = [
      fixture('old-1', { date: '2026-11-14', group: 'U17' }),
      fixture('old-2', { date: '2026-11-16', group: 'U17' }),
    ];
    const incoming = [fixture('new-1', { date: '2026-11-15', group: 'U17' })];
    const changes = diffFixtures(previous, incoming);
    expect(changes.filter(change => change.type === 'missing')).toHaveLength(2);
    expect(changes.filter(change => change.type === 'added')).toHaveLength(1);
  });

  it('quarantines missing fixtures for verification instead of cancelling', () => {
    const [removed] = diffFixtures([fixture('a')], []);
    expect(removed?.type).toBe('missing');
    expect(removed?.status).toBe('verification_required');
    expect(removed?.status).not.toBe('cancelled');
  });
});
