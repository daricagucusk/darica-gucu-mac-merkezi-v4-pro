import { normalizeTeamName } from './identity.js';

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

const MAX_MATCH_DISTANCE_MINUTES = 14 * 24 * 60;
const AMBIGUITY_MARGIN_MINUTES = 12 * 60;

function pairKey(fixture: Fixture): string {
  return [
    normalizeTeamName(fixture.group),
    normalizeTeamName(fixture.home),
    normalizeTeamName(fixture.away),
  ].join('|');
}

function slotKey(fixture: Fixture): string {
  return `${fixture.date}|${fixture.time}`;
}

function kickoffMinutes(fixture: Fixture): number {
  const date = Date.parse(`${fixture.date}T00:00:00Z`);
  const [hours, minutes] = fixture.time.split(':').map(Number);
  return date / 60_000 + (hours || 0) * 60 + (minutes || 0);
}

function classifyMatched(previous: Fixture, current: Fixture): FixtureChange[] {
  const changes: FixtureChange[] = [];
  if (previous.date !== current.date || previous.time !== current.time) {
    changes.push({
      fixtureId: current.id,
      type: 'kickoff_changed',
      previous,
      current,
    });
  }
  if (previous.venue !== current.venue) {
    changes.push({
      fixtureId: current.id,
      type: 'venue_changed',
      previous,
      current,
    });
  }
  if (
    normalizeTeamName(previous.home) !== normalizeTeamName(current.home) ||
    normalizeTeamName(previous.away) !== normalizeTeamName(current.away) ||
    normalizeTeamName(previous.group) !== normalizeTeamName(current.group)
  ) {
    changes.push({
      fixtureId: current.id,
      type: 'teams_changed',
      previous,
      current,
    });
  }
  return changes;
}

export function diffFixtures(
  previous: Fixture[],
  incoming: Fixture[],
): FixtureChange[] {
  const matchedPrevious = new Set<number>();
  const matchedIncoming = new Set<number>();
  const changes: FixtureChange[] = [];

  const match = (previousIndex: number, incomingIndex: number) => {
    if (matchedPrevious.has(previousIndex) || matchedIncoming.has(incomingIndex)) return;
    matchedPrevious.add(previousIndex);
    matchedIncoming.add(incomingIndex);
    changes.push(...classifyMatched(previous[previousIndex], incoming[incomingIndex]));
  };

  const previousGroups = new Map<string, number[]>();
  const incomingGroups = new Map<string, number[]>();

  previous.forEach((fixture, index) => {
    const key = pairKey(fixture);
    previousGroups.set(key, [...(previousGroups.get(key) ?? []), index]);
  });
  incoming.forEach((fixture, index) => {
    const key = pairKey(fixture);
    incomingGroups.set(key, [...(incomingGroups.get(key) ?? []), index]);
  });

  for (const [key, previousIndices] of previousGroups) {
    const incomingIndices = incomingGroups.get(key);
    if (!incomingIndices?.length) continue;

    const candidates: Array<{ previousIndex: number; incomingIndex: number; cost: number }> = [];
    for (const previousIndex of previousIndices) {
      for (const incomingIndex of incomingIndices) {
        const cost = Math.abs(
          kickoffMinutes(previous[previousIndex]) - kickoffMinutes(incoming[incomingIndex]),
        );
        if (cost <= MAX_MATCH_DISTANCE_MINUTES) {
          candidates.push({ previousIndex, incomingIndex, cost });
        }
      }
    }
    candidates.sort((a, b) =>
      a.cost - b.cost ||
      a.previousIndex - b.previousIndex ||
      a.incomingIndex - b.incomingIndex,
    );

    for (const candidate of candidates) {
      if (matchedPrevious.has(candidate.previousIndex) || matchedIncoming.has(candidate.incomingIndex)) {
        continue;
      }

      const previousOptions = candidates
        .filter((item) =>
          item.previousIndex === candidate.previousIndex &&
          !matchedIncoming.has(item.incomingIndex),
        )
        .sort((a, b) => a.cost - b.cost);
      const incomingOptions = candidates
        .filter((item) =>
          item.incomingIndex === candidate.incomingIndex &&
          !matchedPrevious.has(item.previousIndex),
        )
        .sort((a, b) => a.cost - b.cost);

      const previousAmbiguous = previousOptions.length > 1 &&
        previousOptions[1].cost - previousOptions[0].cost <= AMBIGUITY_MARGIN_MINUTES;
      const incomingAmbiguous = incomingOptions.length > 1 &&
        incomingOptions[1].cost - incomingOptions[0].cost <= AMBIGUITY_MARGIN_MINUTES;

      if (previousAmbiguous || incomingAmbiguous) continue;
      match(candidate.previousIndex, candidate.incomingIndex);
    }
  }

  // A team/category change can alter the pair key. Match only a unique identical date/time slot.
  const previousSlots = new Map<string, number[]>();
  const incomingSlots = new Map<string, number[]>();

  previous.forEach((fixture, index) => {
    if (matchedPrevious.has(index)) return;
    const key = slotKey(fixture);
    previousSlots.set(key, [...(previousSlots.get(key) ?? []), index]);
  });
  incoming.forEach((fixture, index) => {
    if (matchedIncoming.has(index)) return;
    const key = slotKey(fixture);
    incomingSlots.set(key, [...(incomingSlots.get(key) ?? []), index]);
  });

  for (const [key, previousIndices] of previousSlots) {
    const incomingIndices = incomingSlots.get(key);
    if (previousIndices.length === 1 && incomingIndices?.length === 1) {
      match(previousIndices[0], incomingIndices[0]);
    }
  }

  incoming.forEach((fixture, index) => {
    if (!matchedIncoming.has(index)) {
      changes.push({ fixtureId: fixture.id, type: 'added', current: fixture });
    }
  });

  previous.forEach((fixture, index) => {
    if (!matchedPrevious.has(index)) {
      changes.push({
        fixtureId: fixture.id,
        type: 'missing',
        status: 'verification_required',
        previous: fixture,
      });
    }
  });

  return changes;
}
