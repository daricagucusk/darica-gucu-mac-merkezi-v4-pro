import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAskfRows, parseAskfWorkbook } from './parse-askf';

describe('ASKF Excel ingestion', () => {
  it('parses the latest live ASKF workbook downloaded from the official file manager', async () => {
    const bytes = await readFile(resolve(process.cwd(), 'tests/fixtures/011.HAFTA PROGRAM.xls'));
    const parsed = await parseAskfWorkbook(bytes, '011.HAFTA PROGRAM.xls');

    expect(parsed.sourceWeek).toBe(11);
    expect(parsed.matches.length).toBeGreaterThan(30);
    expect(new Set(parsed.matches.map((match) => match.id)).size).toBe(parsed.matches.length);
    expect(parsed.daricaMatches.length).toBeGreaterThan(0);
    expect(parsed.daricaMatches.every((match) =>
      match.homeId === 'darica gucu spor' || match.awayId === 'darica gucu spor'
    )).toBe(true);
    expect(parsed.daricaMatches.some((match) =>
      match.home.toLocaleLowerCase('tr-TR').includes('kartalgücü') ||
      match.away.toLocaleLowerCase('tr-TR').includes('kartalgücü')
    )).toBe(false);
  });

  it('parses the archived ASKF XLS data and supports U11-U19 categories', async () => {
    const bytes = await readFile(resolve(process.cwd(), 'tests/fixtures/010.HAFTA PROGRAM.xls'));
    const parsed = await parseAskfWorkbook(bytes, '010.HAFTA PROGRAM.xls');

    expect(parsed.sourceWeek).toBe(10);
    expect(parsed.sourceTitle).toContain('03 KASIM 2026');
    expect(parsed.matches.length).toBeGreaterThan(180);
    expect(parsed.matches.some((match) => match.group === 'U17')).toBe(true);
    expect(new Set(parsed.matches.map((match) => match.id)).size).toBe(parsed.matches.length);
    expect(parsed.daricaMatches.length).toBeGreaterThan(0);
  });

  it('rejects a file whose bytes do not match its declared Excel type', async () => {
    await expect(parseAskfWorkbook(new TextEncoder().encode('not an excel file'), 'weekly.xls')).rejects.toThrow();
  });

  it('parses U19 while keeping Darıca Kartalgücü separate', () => {
    const parsed = parseAskfRows([
      { sheet: 'Sheet1', rowNumber: 1, cells: ['03 KASIM 2026 SALI'] },
      { sheet: 'Sheet1', rowNumber: 2, cells: ['( 06 KASIM 2026 ) CUMA'] },
      { sheet: 'Sheet1', rowNumber: 3, cells: ['U-19 1 GRUP', 'DARICA GÜCÜ SPOR', 'RAKİP SPOR', '19.15', 'DARICA NENEHATUN STADI'] },
      { sheet: 'Sheet1', rowNumber: 4, cells: ['U-19 1 GRUP', 'DARICA KARTALGÜCÜ SPOR', 'BAŞKA SPOR', '19.15', 'DARICA NENEHATUN STADI'] },
    ], '012.HAFTA PROGRAM.xls');

    expect(parsed.matches).toHaveLength(2);
    expect(parsed.daricaMatches).toHaveLength(1);
    expect(parsed.daricaMatches[0].group).toBe('U19');
  });
});
