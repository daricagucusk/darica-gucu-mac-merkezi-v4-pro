import { describe, expect, it } from 'vitest';
import { evaluateSnapshot, type IncomingSnapshot, type VerifiedSnapshot } from './snapshot';

const validIncoming = (overrides: Partial<IncomingSnapshot> = {}): IncomingSnapshot => ({
  source: 'Kocaeli ASKF',
  provenance: 'official_site_download',
  sourceFile: '011.HAFTA PROGRAM.xls',
  sourceWeek: 11,
  sourceSeason: '2026-2027',
  sourceHash: 'a'.repeat(64),
  checkedAt: '2026-11-11T16:10:00+03:00',
  parserVersion: 'v4-test',
  matches: Array.from({ length: 60 }, (_, i) => ({ id: `fixture-${i}` })),
  ...overrides,
});

const previous: VerifiedSnapshot = {
  sourceFile: '010.HAFTA PROGRAM.xls',
  sourceWeek: 10,
  sourceSeason: '2026-2027',
  sourceHash: 'b'.repeat(64),
  matches: Array.from({ length: 100 }, (_, i) => ({ id: `fixture-${i}` })),
};

describe('snapshot acceptance', () => {
  it('accepts the first valid official snapshot', () => {
    expect(evaluateSnapshot(null, validIncoming()).apply).toBe(true);
  });

  it('rejects unverified provenance and malformed SHA-256', () => {
    expect(evaluateSnapshot(null, validIncoming({ provenance: 'manual_upload' })).apply).toBe(false);
    expect(evaluateSnapshot(null, validIncoming({ sourceHash: 'not-a-hash' })).apply).toBe(false);
  });

  it('rejects duplicate fixture identities before publication', () => {
    const matches = Array.from({ length: 60 }, (_, i) => ({ id: `fixture-${i}` }));
    matches[59] = { id: 'fixture-0' };
    expect(evaluateSnapshot(null, validIncoming({ matches })).reason).toBe('invalid');
  });

  it('rejects an older source week in the same season', () => {
    expect(evaluateSnapshot(previous, validIncoming({ sourceWeek: 9 })).reason).toBe('older-week');
  });

  it('rejects an older season even when its week number is higher', () => {
    expect(evaluateSnapshot(previous, validIncoming({ sourceSeason: '2025-2026', sourceWeek: 12 })).reason).toBe('older-season');
  });

  it('accepts a newer season starting at week one without comparing old-season fixture counts', () => {
    const incoming = validIncoming({
      sourceSeason: '2027-2028',
      sourceWeek: 1,
      matches: Array.from({ length: 35 }, (_, i) => ({ id: `new-season-${i}` })),
    });
    expect(evaluateSnapshot(previous, incoming).apply).toBe(true);
  });

  it('rejects unchanged source hash', () => {
    expect(evaluateSnapshot(previous, validIncoming({ sourceHash: previous.sourceHash })).reason).toBe('unchanged');
  });

  it('accepts a newer snapshot when fixture count remains within the guardrail', () => {
    expect(evaluateSnapshot(previous, validIncoming()).apply).toBe(true);
  });

  it('rejects abnormal fixture loss without replacing previous snapshot', () => {
    const incoming = validIncoming({ matches: Array.from({ length: 40 }, (_, i) => ({ id: `fixture-${i}` })) });
    const decision = evaluateSnapshot(previous, incoming);
    expect(decision.apply).toBe(false);
    expect(decision.reason).toBe('abnormal-loss');
    expect(decision.preservePrevious).toBe(true);
  });
});
