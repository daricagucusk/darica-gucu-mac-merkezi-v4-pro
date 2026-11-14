export interface DashboardMatch {
  id: string;
  group: string;
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
  status: 'scheduled' | 'postponed' | 'cancelled';
}

export interface DashboardInput {
  matches: DashboardMatch[];
  daricaMatches: DashboardMatch[];
  trackedClubCount: number;
  changes: Array<{ fixtureId: string; type: string }>;
  now: Date;
  sourceState: string;
  freshness?: string;
}

export interface DashboardMetrics {
  fixtureCount: number;
  daricaFixtureCount: number;
  trackedClubCount: number;
  upcomingCount: number;
  changeCount: number;
  categoryCounts: Array<{ category: string; count: number }>;
  nextMatch: DashboardMatch | null;
  sourceLabel: 'GÜNCEL' | 'ESKİ VERİ' | 'DOĞRULAMA BEKLENİYOR';
}

function fixtureTimestamp(date: string, time: string): number {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = time.match(/^(\d{2}):(\d{2})$/);
  if (!match || !clock) return Number.NaN;
  const [, year, month, day] = match;
  const [, hour, minute] = clock;
  // The source fixture times are Kocaeli local time (Europe/Istanbul, UTC+3).
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) - 3 * 60 * 60 * 1000;
}

export function buildDashboardMetrics(input: DashboardInput): DashboardMetrics {
  const upcoming = input.daricaMatches
    .filter((match) => match.status === 'scheduled')
    .map((match) => ({ match, timestamp: fixtureTimestamp(match.date, match.time) }))
    .filter((item) => Number.isFinite(item.timestamp) && item.timestamp >= input.now.getTime())
    .sort((a, b) => a.timestamp - b.timestamp);

  const categoryMap = new Map<string, number>();
  for (const match of input.matches) {
    categoryMap.set(match.group, (categoryMap.get(match.group) ?? 0) + 1);
  }

  const stale = input.freshness === 'stale' || input.sourceState === 'refresh_failed';
  const sourceLabel = stale
    ? 'ESKİ VERİ'
    : input.sourceState === 'verified'
      ? 'GÜNCEL'
      : 'DOĞRULAMA BEKLENİYOR';

  return {
    fixtureCount: input.matches.length,
    daricaFixtureCount: input.daricaMatches.length,
    trackedClubCount: Math.max(0, input.trackedClubCount),
    upcomingCount: upcoming.length,
    changeCount: input.changes.length,
    categoryCounts: [...categoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category, 'tr')),
    nextMatch: upcoming[0]?.match ?? null,
    sourceLabel,
  };
}
