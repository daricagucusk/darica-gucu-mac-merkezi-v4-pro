import ExcelJS from 'exceljs';
import { readXls } from 'xls-reader';
import { canonicalTeamId, normalizeTeamName } from '../domain/identity.js';

export interface AskfRow {
  sheet: string;
  rowNumber: number;
  cells: unknown[];
}

export interface ParsedAskfFixture {
  id: string;
  group: string;
  date: string;
  time: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  field: string;
  venue: string;
  status: 'scheduled' | 'postponed' | 'cancelled';
  sourceSheet: string;
  sourceRow: number;
}

export interface ParsedAskfSchedule {
  sourceFile: string;
  sourceWeek: number;
  sourceTitle: string;
  season: string;
  rangeStart: string;
  rangeEnd: string;
  matches: ParsedAskfFixture[];
  daricaMatches: ParsedAskfFixture[];
  notices: string[];
}

const MONTHS: Record<string, number> = {
  ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6,
  temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
};

const TEAM_ALIASES: Record<string, string> = {
  'darica gucu': 'darica gucu spor',
  'darica g s': 'darica gucu spor',
  'darica gs': 'darica gucu spor',
  'darica g spor': 'darica gucu spor',
  'darica gucu sk': 'darica gucu spor',
  'darica gucu spor kulubu': 'darica gucu spor',
};

const fold = (value: unknown): string => normalizeTeamName(String(value ?? ''));
const isDaricaGucu = (value: unknown): boolean =>
  canonicalTeamId(String(value ?? ''), TEAM_ALIASES) === 'darica gucu spor';

function ageGroup(value: unknown): string | null {
  const match = fold(value).match(/\bu\s*[-–]?\s*(1[1-9])\b/i);
  return match ? `U${match[1]}` : null;
}

function headingDate(value: unknown): Date | null {
  const match = fold(value).match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/i);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (!month) return null;
  const parsed = new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1])));
  return parsed.getUTCFullYear() === Number(match[3]) &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === Number(match[1]) ? parsed : null;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseClock(value: unknown): string {
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const total = Math.round(value * 1440);
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  const match = String(value ?? '').match(/\b(\d{1,2})[.:](\d{2})(?::\d{2})?\b/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : '';
}

function seasonFor(date: Date): string {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function sourceWeekFor(fileName: string): number {
  const match = fileName.match(/(\d{1,3})\s*\.?\s*hafta\s*program/i);
  return match ? Number(match[1]) : 0;
}

function statusFor(row: AskfRow): ParsedAskfFixture['status'] {
  const text = fold(row.cells.join(' '));
  if (text.includes('ertel')) return 'postponed';
  if (text.includes('iptal')) return 'cancelled';
  return 'scheduled';
}

export function parseAskfRows(rows: AskfRow[], sourceFile: string): ParsedAskfSchedule {
  const matches: ParsedAskfFixture[] = [];
  const notices: string[] = [];
  let currentDate: Date | null = null;
  let sourceTitle = '';

  for (const row of rows) {
    const first = String(row.cells[0] ?? '').trim();
    if (row.rowNumber === 1 && !sourceTitle) sourceTitle = first.split('\n')[0].trim();

    const dateHeading = headingDate(first);
    if (dateHeading && (row.rowNumber === 1 || !first || first.startsWith('('))) {
      currentDate = dateHeading;
      continue;
    }

    const group = ageGroup(first);
    if (!group) continue;

    const home = String(row.cells[1] ?? '').trim();
    const away = String(row.cells[2] ?? '').trim();
    if (!home || !away) continue;

    const homeId = canonicalTeamId(home, TEAM_ALIASES);
    const awayId = canonicalTeamId(away, TEAM_ALIASES);
    const isTrackedMatch = isDaricaGucu(home) || isDaricaGucu(away);

    if (!currentDate) {
      const notice = `${row.sheet}:${row.rowNumber} maçının tarih bilgisi eksik; doğrulama gerekli`;
      if (isTrackedMatch) throw new Error(notice);
      notices.push(notice);
      continue;
    }

    const time = parseClock(row.cells[3]);
    const field = String(row.cells[4] ?? '').trim();
    if (!time || !field) {
      const notice = `${row.sheet}:${row.rowNumber} maçında saat veya saha bilgisi eksik`;
      if (isTrackedMatch) throw new Error(notice);
      notices.push(notice);
      continue;
    }

    const date = isoDate(currentDate);
    const fixtureSeason = seasonFor(currentDate);
    const id = [fixtureSeason, group, homeId, awayId].join('|');
    matches.push({
      id, group, date, time, home, away, homeId, awayId,
      field, venue: field, status: statusFor(row),
      sourceSheet: row.sheet, sourceRow: row.rowNumber,
    });
  }

  if (!sourceTitle) throw new Error('ASKF dosyasında başlık bulunamadı.');
  if (matches.length === 0) throw new Error('ASKF dosyasında geçerli U11-U19 maçı bulunamadı.');

  matches.sort((a, b) =>
    a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.group.localeCompare(b.group),
  );

  const uniqueNotices = [...new Set(notices)];
  const dates = matches.map((match) => match.date).sort();
  return {
    sourceFile,
    sourceWeek: sourceWeekFor(sourceFile),
    sourceTitle,
    season: seasonFor(new Date(`${dates[0]}T00:00:00Z`)),
    rangeStart: dates[0],
    rangeEnd: dates[dates.length - 1],
    matches,
    daricaMatches: matches.filter((match) =>
      match.homeId === 'darica gucu spor' || match.awayId === 'darica gucu spor',
    ),
    notices: uniqueNotices,
  };
}

function isLegacyXls(bytes: Uint8Array): boolean {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return signature.every((byte, index) => bytes[index] === byte);
}

function isZipWorkbook(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

export async function parseAskfWorkbook(
  input: Uint8Array | ArrayBuffer,
  fileName: string,
): Promise<ParsedAskfSchedule> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 8 || bytes.length > 12 * 1024 * 1024) {
    throw new Error('ASKF Excel dosyası boş veya 12 MB sınırını aşıyor.');
  }

  const lowerName = fileName.toLowerCase();
  const rows: AskfRow[] = [];

  if (lowerName.endsWith('.xls')) {
    if (!isLegacyXls(bytes)) throw new Error('Dosya uzantısı XLS ancak içerik BIFF/OLE Excel değil.');
    const workbook = readXls(bytes);
    for (const sheet of workbook.sheets ?? []) {
      (sheet.rows ?? []).forEach((cells: readonly unknown[], index: number) => {
        rows.push({ sheet: sheet.name ?? 'Sayfa', rowNumber: index + 1, cells: cells.slice(0, 5) });
      });
    }
  } else if (lowerName.endsWith('.xlsx')) {
    if (!isZipWorkbook(bytes)) throw new Error('Dosya uzantısı XLSX ancak içerik ZIP/OOXML Excel değil.');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    for (const sheet of workbook.worksheets) {
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const cells = Array.from({ length: 5 }, (_, index) => {
          const value = row.getCell(index + 1).value;
          if (value && typeof value === 'object' && 'text' in value) return value.text;
          if (value && typeof value === 'object' && 'result' in value) return value.result;
          return value;
        });
        rows.push({ sheet: sheet.name, rowNumber, cells });
      });
    }
  } else {
    throw new Error('ASKF kaynağında yalnızca .xls ve .xlsx dosyaları kabul edilir.');
  }

  return parseAskfRows(rows, fileName);
}
