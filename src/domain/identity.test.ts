import { describe, expect, it } from 'vitest';
import { canonicalTeamId, fixtureIdentity, normalizeTeamName } from './identity';

describe('team identity', () => {
  it('normalizes Turkish casing, punctuation, and repeated whitespace', () => {
    expect(normalizeTeamName('  DARICA   GÜCÜ  SPOR ')).toBe('darica gucu spor');
    expect(normalizeTeamName('ÇAYIROVA BLD. EĞİTİM SPOR')).toBe('cayirova bld egitim spor');
  });

  it('maps configured aliases to the same canonical team', () => {
    const aliases = { 'darica g.s.': 'darica gücü spor', 'darica gUcu': 'darica gücü spor' };
    expect(canonicalTeamId('Darıca G.S.', aliases)).toBe(canonicalTeamId('Darıca Gücü Spor', aliases));
  });

  it('keeps Darıca Gücü and Darıca Kartalgücü distinct', () => {
    expect(canonicalTeamId('Darıca Gücü Spor')).not.toBe(canonicalTeamId('Darıca Kartalgücü Spor'));
  });

  it('creates stable fixture identity from teams, group, kickoff, and venue', () => {
    const base = { home: 'Darıca Gücü Spor', away: 'Çayırova Serhat Spor', group: 'U14', date: '2026-11-10', time: '19:15', venue: 'Darıca Nenehatun Stadı' };
    expect(fixtureIdentity(base)).toBe(fixtureIdentity({ ...base, home: 'DARICA GÜCÜ SPOR' }));
    expect(fixtureIdentity(base)).not.toBe(fixtureIdentity({ ...base, venue: 'Çayırova Kuştepe Stadı' }));
    expect(fixtureIdentity(base)).not.toBe(fixtureIdentity({ ...base, time: '19:30' }));
  });
});
