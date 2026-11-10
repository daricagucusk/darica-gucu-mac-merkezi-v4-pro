export interface IncomingSnapshot {
  source: string;
  provenance: string;
  sourceFile: string;
  sourceWeek: number;
  sourceHash: string;
  checkedAt: string;
  parserVersion: string;
  matches: Array<{ id: string }>;
}

export interface VerifiedSnapshot {
  sourceFile: string;
  sourceWeek: number;
  sourceHash: string;
  matches: Array<{ id: string }>;
}

export interface SnapshotDecision {
  apply: boolean;
  reason: 'accepted' | 'invalid' | 'older-week' | 'unchanged' | 'abnormal-loss';
  preservePrevious: boolean;
}

const MINIMUM_FIXTURES = 30;
const ABNORMAL_LOSS_RATIO = 0.55;

export function evaluateSnapshot(
  previous: VerifiedSnapshot | null,
  incoming: IncomingSnapshot,
): SnapshotDecision {
  const reject = (reason: SnapshotDecision['reason']): SnapshotDecision => ({
    apply: false,
    reason,
    preservePrevious: previous !== null,
  });

  const fixtureIds = Array.isArray(incoming.matches)
    ? incoming.matches.map((match) => match?.id?.trim())
    : [];
  const uniqueFixtureIds = new Set(fixtureIds);

  if (
    incoming.source !== 'Kocaeli ASKF' ||
    incoming.provenance !== 'official_site_download' ||
    !/\.xlsx?$/i.test(incoming.sourceFile) ||
    !Number.isInteger(incoming.sourceWeek) ||
    incoming.sourceWeek < 1 ||
    !/^[a-f0-9]{64}$/i.test(incoming.sourceHash) ||
    !Number.isFinite(Date.parse(incoming.checkedAt)) ||
    !incoming.parserVersion?.trim() ||
    !Array.isArray(incoming.matches) ||
    incoming.matches.length < MINIMUM_FIXTURES ||
    fixtureIds.some((id) => !id) ||
    uniqueFixtureIds.size !== fixtureIds.length
  ) {
    return reject('invalid');
  }

  if (!previous) {
    return { apply: true, reason: 'accepted', preservePrevious: false };
  }

  if (incoming.sourceWeek < previous.sourceWeek) return reject('older-week');
  if (incoming.sourceHash.toLowerCase() === previous.sourceHash.toLowerCase()) {
    return reject('unchanged');
  }

  if (
    previous.matches.length > 0 &&
    incoming.matches.length < previous.matches.length * ABNORMAL_LOSS_RATIO
  ) {
    return reject('abnormal-loss');
  }

  return { apply: true, reason: 'accepted', preservePrevious: false };
}
