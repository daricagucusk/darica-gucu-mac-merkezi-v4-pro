export interface FixtureIdentityInput {
  home: string;
  away: string;
  group: string;
  date: string;
  time: string;
  venue: string;
}

const foldTurkish = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export function normalizeTeamName(name: string): string {
  return foldTurkish(name);
}

export function canonicalTeamId(
  name: string,
  aliases: Record<string, string> = {},
): string {
  const normalized = normalizeTeamName(name);
  const aliasEntry = Object.entries(aliases).find(
    ([alias]) => normalizeTeamName(alias) === normalized,
  );
  return aliasEntry ? normalizeTeamName(aliasEntry[1]) : normalized;
}

export function fixtureIdentity(fixture: FixtureIdentityInput): string {
  const home = canonicalTeamId(fixture.home);
  const away = canonicalTeamId(fixture.away);
  return [
    home,
    away,
    foldTurkish(fixture.group),
    fixture.date.trim(),
    fixture.time.trim(),
    foldTurkish(fixture.venue),
  ].join('|');
}
