export interface MatchReminderIdentity {
  season: string;
  fixtureId: string;
  date: string;
  time: string;
}

export function buildMatchReminderKey(input: MatchReminderIdentity): string {
  return [
    'match-reminder',
    input.season.trim(),
    input.fixtureId.trim(),
    input.date,
    input.time,
  ].join(':');
}

function localFixtureTimestamp(date: string, time: string): number {
  const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = time.match(/^(\d{2}):(\d{2})$/);
  if (!dateParts || !timeParts) return Number.NaN;
  return Date.UTC(
    Number(dateParts[1]),
    Number(dateParts[2]) - 1,
    Number(dateParts[3]),
    Number(timeParts[1]),
    Number(timeParts[2]),
  ) - 3 * 60 * 60 * 1000;
}

export function isWithinReminderWindow(
  date: string,
  time: string,
  now: Date,
  windowHours = 30,
): boolean {
  if (!Number.isFinite(windowHours) || windowHours <= 0 || windowHours > 72) return false;
  const kickoff = localFixtureTimestamp(date, time);
  if (!Number.isFinite(kickoff)) return false;
  const delta = kickoff - now.getTime();
  return delta >= 0 && delta <= windowHours * 60 * 60 * 1000;
}
