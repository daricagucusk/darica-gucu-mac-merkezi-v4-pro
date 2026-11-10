import { describe, expect, it } from 'vitest';
import { selectLatestAskfFile } from './source-selection';

describe('ASKF file manager selection', () => {
  it('selects the highest published week, not the first visible file', () => {
    const selected = selectLatestAskfFile([
      { name: '008.HAFTA PROGRAM.xls' },
      { name: '010.HAFTA PROGRAM.xls' },
      { name: '009.HAFTA PROGRAM.xlsx' },
      { name: 'ASKF Duyuru.pdf' },
    ]);
    expect(selected.name).toBe('010.HAFTA PROGRAM.xls');
    expect(selected.week).toBe(10);
  });

  it('extracts the weekly file name when the manager appends size metadata', () => {
    const selected = selectLatestAskfFile([
      { name: '010.HAFTA PROGRAM.xls 232 KB' },
    ]);
    expect(selected.week).toBe(10);
  });

  it('prefers XLSX when the same week is published in both supported formats', () => {
    const selected = selectLatestAskfFile([
      { name: '011.HAFTA PROGRAM.xls' },
      { name: '011.HAFTA PROGRAM.xlsx' },
    ]);
    expect(selected.name).toBe('011.HAFTA PROGRAM.xlsx');
  });

  it('rejects unrelated files and fails closed when no weekly file exists', () => {
    expect(() => selectLatestAskfFile([
      { name: '2026-2027' },
      { name: 'Haftalık Program.pdf' },
      { name: '010.HAFTA PROGRAM.csv' },
    ])).toThrow(/haftalık program dosyası bulunamadı/i);
  });
});
