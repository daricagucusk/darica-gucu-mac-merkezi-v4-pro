import { describe, expect, it } from 'vitest';
import { stageVerifiedSnapshot, type AskfStagingStorage } from './stage-askf';
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

function fakeStorage() {
  const calls: string[] = [];
  const storage: AskfStagingStorage = {
    writeSource: async () => { calls.push('source'); },
    writeSnapshot: async () => { calls.push('snapshot'); },
    writePending: async () => { calls.push('pending'); },
  };
  return { calls, storage };
}

describe('ASKF pending staging', () => {
  it('archives a verified program and creates pending review without writing live data', async () => {
    const { calls, storage } = fakeStorage();
    const result = await stageVerifiedSnapshot({
      previous: null,
      schedule: schedule(Array.from({ length: 40 }, (_, i) => fixture(i))),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });

    expect(result.status).toBe('staged');
    if (result.status === 'staged') {
      expect(result.pending.state).toBe('pending_review');
      expect(result.pending.snapshot.sourceHash).toBe('a'.repeat(64));
      expect(result.pending.snapshot.matches).toHaveLength(40);
    }
    expect(calls).toEqual(['source', 'snapshot', 'pending']);
  });

  it('does not create a second pending item for the active file hash', async () => {
    const { calls, storage } = fakeStorage();
    const matches = Array.from({ length: 40 }, (_, i) => fixture(i));
    const result = await stageVerifiedSnapshot({
      previous: {
        sourceFile: '011.HAFTA PROGRAM.xls',
        sourceWeek: 11,
        sourceSeason: '2026-2027',
        sourceHash: 'a'.repeat(64),
        matches,
        checkedAt: '2026-11-11T16:00:00+03:00',
      },
      schedule: schedule(matches),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T17:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.decision.reason).toBe('unchanged');
    expect(calls).toEqual([]);
  });

  it('rejects invalid schedules before writing any archive or pending pointer', async () => {
    const { calls, storage } = fakeStorage();
    const result = await stageVerifiedSnapshot({
      previous: null,
      schedule: schedule([]),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });

    expect(result.status).toBe('rejected');
    expect(calls).toEqual([]);
  });

  it('rejects an abnormal fixture loss without touching the pending queue', async () => {
    const { calls, storage } = fakeStorage();
    const previousMatches = Array.from({ length: 80 }, (_, i) => fixture(i));
    const result = await stageVerifiedSnapshot({
      previous: {
        sourceFile: '010.HAFTA PROGRAM.xls',
        sourceWeek: 10,
        sourceSeason: '2026-2027',
        sourceHash: 'b'.repeat(64),
        matches: previousMatches,
      },
      schedule: schedule(previousMatches.slice(0, 40)),
      sourceHash: 'a'.repeat(64),
      checkedAt: '2026-11-11T16:00:00+03:00',
      parserVersion: 'v4-test',
      rawBytes: new Uint8Array([1, 2, 3]),
      storage,
    });

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.decision.reason).toBe('abnormal-loss');
    expect(calls).toEqual([]);
  });
});
