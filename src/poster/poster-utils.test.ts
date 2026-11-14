import { describe, expect, it } from 'vitest';
import { buildPosterCopy, getPosterDimensions, type PosterFixture } from './poster-utils';

const fixture: PosterFixture = {
  id: 'fixture-1',
  group: 'U14',
  date: '2026-11-21',
  time: '14:30',
  home: 'Darıca Gücü Spor',
  away: 'Gebze Spor',
  venue: 'Darıca Nenehatun Stadı',
  status: 'scheduled',
};

describe('poster utilities', () => {
  it('returns exact export dimensions for the three social formats', () => {
    expect(getPosterDimensions('portrait')).toEqual({ width: 1080, height: 1350 });
    expect(getPosterDimensions('square')).toEqual({ width: 1080, height: 1080 });
    expect(getPosterDimensions('story')).toEqual({ width: 1080, height: 1920 });
  });

  it('builds fixture copy only from a verified match and keeps the Turkish fixture facts', () => {
    const copy = buildPosterCopy({
      template: 'matchday',
      fixture,
      verified: true,
      title: 'MAÇ GÜNÜ',
      subtitle: 'Takımımızı destekle',
    });

    expect(copy.headline).toBe('MAÇ GÜNÜ');
    expect(copy.details).toContain('Darıca Gücü Spor');
    expect(copy.details).toContain('Gebze Spor');
    expect(copy.details).toContain('U14');
    expect(copy.details).toContain('14:30');
    expect(copy.details).toContain('Darıca Nenehatun Stadı');
    expect(copy.caption).toContain('21 Kasım 2026');
  });

  it('rejects fixture-based posters when source data is not verified', () => {
    expect(() => buildPosterCopy({
      template: 'weekly-program',
      fixture,
      verified: false,
    })).toThrow(/doğrulanmış/i);
  });

  it('allows a general club announcement without claiming a fixture exists', () => {
    const copy = buildPosterCopy({
      template: 'announcement',
      fixture: null,
      verified: false,
      title: 'KULÜP DUYURUSU',
      subtitle: 'Yeni dönem kayıtlarımız başladı',
    });

    expect(copy.headline).toBe('KULÜP DUYURUSU');
    expect(copy.details).toContain('Yeni dönem kayıtlarımız başladı');
    expect(copy.caption).toContain('Darıca Gücü');
  });
});
