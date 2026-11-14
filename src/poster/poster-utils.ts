export type PosterFormat = 'portrait' | 'square' | 'story';
export type PosterTemplate = 'matchday' | 'weekly-program' | 'result' | 'announcement';

export interface PosterDimensions {
  width: number;
  height: number;
}

export interface PosterFixture {
  id: string;
  group: string;
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
  status: 'scheduled' | 'postponed' | 'cancelled';
  homeScore?: number;
  awayScore?: number;
}

export interface PosterCopyInput {
  template: PosterTemplate;
  fixture: PosterFixture | null;
  verified: boolean;
  title?: string;
  subtitle?: string;
}

export interface PosterCopy {
  headline: string;
  subtitle: string;
  details: string[];
  caption: string;
}

const DIMENSIONS: Record<PosterFormat, PosterDimensions> = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export function getPosterDimensions(format: PosterFormat): PosterDimensions {
  return { ...DIMENSIONS[format] };
}

function formattedDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00+03:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Afiş tarihi geçersiz.');
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(parsed);
}

export function buildPosterCopy(input: PosterCopyInput): PosterCopy {
  const { template, fixture, verified } = input;
  if (template === 'announcement') {
    const headline = input.title?.trim() || 'KULÜP DUYURUSU';
    const subtitle = input.subtitle?.trim() || 'Darıca Gücü Spor Kulübü';
    return {
      headline,
      subtitle,
      details: [subtitle],
      caption: `Darıca Gücü Spor Kulübü\n${subtitle}`,
    };
  }

  if (!verified || !fixture) {
    throw new Error('Maç afişi için doğrulanmış ASKF fikstürü gereklidir.');
  }

  if (template === 'result' && (
    !Number.isInteger(fixture.homeScore) || !Number.isInteger(fixture.awayScore)
  )) {
    throw new Error('Maç sonucu afişi için doğrulanmış skor bilgisi gereklidir.');
  }

  const headline = input.title?.trim() || (
    template === 'weekly-program' ? 'HAFTALIK PROGRAM' :
    template === 'result' ? 'MAÇ SONUCU' : 'MAÇ GÜNÜ'
  );
  const subtitle = input.subtitle?.trim() || fixture.group;
  const date = formattedDate(fixture.date);
  const details = template === 'result'
    ? [
        fixture.home,
        `${fixture.homeScore}  —  ${fixture.awayScore}`,
        fixture.away,
        fixture.group,
      ]
    : [
        fixture.home,
        'VS',
        fixture.away,
        fixture.group,
        date,
        fixture.time,
        fixture.venue,
      ];

  const caption = template === 'result'
    ? `Darıca Gücü Spor · ${fixture.group}\n${fixture.home} ${fixture.homeScore} - ${fixture.awayScore} ${fixture.away}\n${date}`
    : `Darıca Gücü Spor · ${headline}\n${fixture.group} | ${date} · ${fixture.time}\n${fixture.home} - ${fixture.away}\n${fixture.venue}\n\nTakımımızı desteklemeyi unutma!`;

  return { headline, subtitle, details, caption };
}
