import { describe, expect, it } from 'vitest';
import { publishVerifiedSnapshot, type SnapshotStorage } from './publish';
import type { ParsedAskfFixture, ParsedAskfSchedule } from './parse-askf';

const fixture = (index: number): ParsedAskfFixture => ({
  id: `2026-2027|U12|home-${index}|away-${index}`,
  group: 'U12',
  date: '2026-11-15',
  time: '18:00',
  home: `Home ${index}`,
  away: `Away ${index}`,
  homeId: `home-${index}`,
  awayId: `away-${index}`,
  field: 'Darıca Nenehatun Stadı',
  venue: 'Darıca Nenehatun Stadı',
  status: 'scheduled',
  sourceSheet: 'Sayfa1',
  sourceRow: index + 1,
});

const schedule = (matches: ParsedAskfFixture[], overrides: Partial<ParsedAskfSchedule> = {}): ParsedAskfSchedule => ({
  sourceFile: '011.HAFTA PROGRAM.xls',
  sourceWeek: 11,
  sourceTitle: '11 KASIM 2026',
  season: '2026-2027',
  rangeStart: '2026-11-15',
  rangeEnd: '2026-11-21',
  matches,
  daricaMatches: [],
  notices: [],
  ...overrides,
});

function fakeStorage(failAt?: string) {
  const calls: string[] = [];
  const storage: SnapshotStorage = {
    writeSource: async () => { calls.push('source'); },
    writeSnapshot: async () => { calls.push('snapshot'); if (failAt === 'snapshot') throw new Error('snapshot storage failed'); },
    writeLive: async () => { calls.push('live'); if (failAt === 'live') throw new Error('live pointer failed'); },
  };
  return { calls, storage };
}

describe('verified snapshot publication', () => {
  it('writes raw source and archive before switching the live pointer', async () => {
    const { calls, storage } = fakeStorage();
    const result = await publishVerifiedSnapshot({
      previous: null,
      schedule: schedule(Array.from({ length: 40 }, (_, i) => fixture(i))),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });
    expect(result.status).toBe('published');
    expect(calls).toEqual(['source', 'snapshot', 'live']);
  });

  it('does not write or switch live data when validation rejects the incoming snapshot', async () => {
    const { calls, storage } = fakeStorage();
    const result = await publishVerifiedSnapshot({
      previous: null,
      schedule: schedule(Array.from({ length: 40 }, (_, i) => fixture(i)), { sourceWeek: 0 }),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });
    expect(result.status).toBe('rejected');
    expect(calls).toEqual([]);
  });

  it('keeps the old live pointer when snapshot archive writing fails', async () => {
    const { calls, storage } = fakeStorage('snapshot');
    await expect(publishVerifiedSnapshot({
      previous: null,
      schedule: schedule(Array.from({ length: 40 }, (_, i) => fixture(i))),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    })).rejects.toThrow('snapshot storage failed');
    expect(calls).toEqual(['source', 'snapshot']);
  });

  it('marks a missing fixture verification-required instead of cancelled', async () => {
    const previousMatches = Array.from({ length: 40 }, (_, i) => fixture(i));
    const nextMatches = previousMatches.slice(0, 39);
    const previous = {
      sourceFile: '010.HAFTA PROGRAM.xls',
      sourceWeek: 10,
      sourceSeason: '2026-2027',
      sourceHash: 'b'.repeat(64),
      matches: previousMatches,
      checkedAt: '2026-11-04T16:00:00+03:00',
    };
    const { storage } = fakeStorage();
    const result = await publishVerifiedSnapshot({
      previous,
      schedule: schedule(nextMatches),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });
    expect(result.status).toBe('published');
    if (result.status === 'published') {
      expect(result.snapshot.changes).toContainEqual(expect.objectContaining({
        type: 'missing',
        status: 'verification_required',
      }));
    }
  });

  it('does not compare fixtures across different seasons', async () => {
    const previous = {
      sourceFile: '040.HAFTA PROGRAM.xls',
      sourceWeek: 40,
      sourceSeason: '2026-2027',
      sourceHash: 'b'.repeat(64),
      matches: Array.from({ length: 40 }, (_, i) => fixture(i)),
      checkedAt: '2027-06-30T16:00:00+03:00',
    };
    const nextSeason = schedule(Array.from({ length: 35 }, (_, i) => ({
      ...fixture(i),
      id: `2027-2028|U12|new-home-${i}|new-away-${i}`,
    })), { sourceWeek: 1, season: '2027-2028' });
    const { storage } = fakeStorage();
    const result = await publishVerifiedSnapshot({
      previous,
      schedule: nextSeason,
      sourceHash: 'a'.repeat(64),
      checkedAt: '2027-07-01T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });
    expect(result.status).toBe('published');
    if (result.status === 'published') expect(result.snapshot.changes).toEqual([]);
  });
});
