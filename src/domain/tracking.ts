const PRIMARY_CLUB_KEY = 'DARICAGUCUSPOR';

export function normalizeClubKey(value: string): string {
  const key = String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
  const aliases = new Set([
    'DARICAGUCUSPOR',
    'DARICAGUCU',
    'DARICAGUCU SK'.replace(/[^A-Z0-9]/g, ''),
    'DARICAGUCUSK',
    'DARICAGUCUSKULUBU',
    'DARICAGUCUSPORKULUBU',
  ]);
  return aliases.has(key) ? PRIMARY_CLUB_KEY : key;
}

export function addTrackedName(names: string[], value: string): string[] {
  const clean = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!clean) return [...names];
  const key = normalizeClubKey(clean);
  if (names.some((name) => normalizeClubKey(name) === key)) return [...names];
  return [...names, clean];
}

export function removeTrackedName(names: string[], value: string): string[] {
  const key = normalizeClubKey(value);
  if (!key || key === PRIMARY_CLUB_KEY) return [...names];
  return names.filter((name) => normalizeClubKey(name) !== key);
}

export function matchesForClub<T extends { home: string; away: string }>(matches: T[], club: string): T[] {
  const key = normalizeClubKey(club);
  if (!key) return [];
  return matches.filter((match) =>
    normalizeClubKey(match.home) === key || normalizeClubKey(match.away) === key,
  );
}

export function venuesFrom<T extends { venue?: string; field?: string }>(matches: T[]): string[] {
  const venues = new Map<string, string>();
  for (const match of matches) {
    const value = String(match.venue || match.field || '').replace(/\s+/g, ' ').trim();
    const key = value.toLocaleUpperCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    if (key && !venues.has(key)) venues.set(key, value);
  }
  return [...venues.values()].sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

export function matchesForVenue<T extends { venue?: string; field?: string }>(matches: T[], venue: string): T[] {
  const key = venue.toLocaleUpperCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return matches.filter((match) => {
    const value = String(match.venue || match.field || '').toLocaleUpperCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return value === key;
  });
}
