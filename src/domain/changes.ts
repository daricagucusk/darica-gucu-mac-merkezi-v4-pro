export interface Fixture {
  id: string;
  home: string;
  away: string;
  group: string;
  date: string;
  time: string;
  venue: string;
}

export type FixtureChangeType =
  | 'added'
  | 'kickoff_changed'
  | 'venue_changed'
  | 'teams_changed'
  | 'missing';

export interface FixtureChange {
  fixtureId: string;
  type: FixtureChangeType;
  status?: 'verification_required';
  previous?: Fixture;
  current?: Fixture;
}

export function diffFixtures(
  previous: Fixture[],
  incoming: Fixture[],
): FixtureChange[] {
  const before = new Map(previous.map((fixture) => [fixture.id, fixture]));
  const after = new Map(incoming.map((fixture) => [fixture.id, fixture]));
  const changes: FixtureChange[] = [];

  for (const current of incoming) {
    const old = before.get(current.id);
    if (!old) {
      changes.push({ fixtureId: current.id, type: 'added', current });
      continue;
    }

    if (old.date !== current.date || old.time !== current.time) {
      changes.push({
        fixtureId: current.id,
        type: 'kickoff_changed',
        previous: old,
        current,
      });
    }
    if (old.venue !== current.venue) {
      changes.push({
        fixtureId: current.id,
        type: 'venue_changed',
        previous: old,
        current,
      });
    }
    if (
      old.home !== current.home ||
      old.away !== current.away ||
      old.group !== current.group
    ) {
      changes.push({
        fixtureId: current.id,
        type: 'teams_changed',
        previous: old,
        current,
      });
    }
  }

  for (const old of previous) {
    if (!after.has(old.id)) {
      changes.push({
        fixtureId: old.id,
        type: 'missing',
        status: 'verification_required',
        previous: old,
      });
    }
  }

  return changes;
}
