import { describe, expect, it } from 'vitest';
import { diffFixtures, type Fixture } from './changes';

const fixture = (id: string, time = '18:00', venue = 'Darıca Nenehatun Stadı'): Fixture => ({
  id, home: 'Darıca Gücü Spor', away: 'Rakip Spor', group: 'U13',
  date: '2026-11-15', time, venue,
});

describe('fixture change classification', () => {
  it('reports newly added fixtures', () => {
    expect(diffFixtures([], [fixture('a')])[0]?.type).toBe('added');
  });

  it('reports kickoff and venue changes separately', () => {
    const changes = diffFixtures([fixture('a')], [fixture('a', '18:30', 'Gebze Stadı')]);
    expect(changes.map(change => change.type).sort()).toEqual(['kickoff_changed', 'venue_changed']);
  });

  it('does not report unchanged fixtures', () => {
    expect(diffFixtures([fixture('a')], [fixture('a')])).toEqual([]);
  });

  it('quarantines missing fixtures for verification instead of cancelling', () => {
    const [removed] = diffFixtures([fixture('a')], []);
    expect(removed?.type).toBe('missing');
    expect(removed?.status).toBe('verification_required');
    expect(removed?.status).not.toBe('cancelled');
  });
});
