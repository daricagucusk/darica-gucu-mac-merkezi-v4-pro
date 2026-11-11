import { describe, expect, it } from 'vitest';
import {
  addTrackedName,
  matchesForClub,
  matchesForVenue,
  normalizeClubKey,
  removeTrackedName,
  venuesFrom,
} from './tracking';

const fixtures = [
  { home: 'DARICA GÜCÜ SPOR', away: 'ÇAYIROVA SERHAT SPOR', venue: 'DARICA NENEHATUN STADI' },
  { home: 'DARICA KARTAL GÜCÜ SPOR', away: 'GEBZE SPOR', venue: 'DARICA NENEHATUN STADI 2' },
  { home: 'GEBZE SPOR', away: 'ÇAYIROVA SERHAT SPOR', venue: 'GEBZE ALAETTİN KURT STADI' },
];

describe('tracking preferences', () => {
  it('normalizes Turkish aliases without merging distinct clubs', () => {
    expect(normalizeClubKey('Darıca Gücü Spor')).toBe(normalizeClubKey('DARICA GÜCÜ SK'));
    expect(normalizeClubKey('Darıca Kartalgücü Spor')).not.toBe(normalizeClubKey('Darıca Gücü Spor'));
  });

  it('adds names without duplicates and ignores blank values', () => {
    expect(addTrackedName(['Darıca Gücü Spor'], 'DARICA GÜCÜ SK')).toHaveLength(1);
    expect(addTrackedName(['Darıca Gücü Spor'], '   ')).toHaveLength(1);
    expect(addTrackedName([], 'Gebze Spor')).toEqual(['Gebze Spor']);
  });

  it('does not allow the primary club to be removed', () => {
    expect(removeTrackedName(['Darıca Gücü Spor', 'Gebze Spor'], 'DARICA GÜCÜ SK')).toEqual(['Darıca Gücü Spor', 'Gebze Spor']);
    expect(removeTrackedName(['Darıca Gücü Spor', 'Gebze Spor'], 'Gebze Spor')).toEqual(['Darıca Gücü Spor']);
  });

  it('filters exact canonical club identities', () => {
    expect(matchesForClub(fixtures, 'Darıca Gücü Spor')).toHaveLength(1);
    expect(matchesForClub(fixtures, 'Darıca Kartalgücü Spor')).toHaveLength(1);
  });

  it('builds unique venue catalogue and filters by venue', () => {
    expect(venuesFrom(fixtures)).toHaveLength(3);
    expect(matchesForVenue(fixtures, 'DARICA NENEHATUN STADI')).toHaveLength(1);
  });
});
