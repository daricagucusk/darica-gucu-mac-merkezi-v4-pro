export interface AskfFileCandidate {
  name: string;
  label?: string;
}

export interface SelectedAskfFile extends AskfFileCandidate {
  week: number;
}

function weekFromName(name: string): number | null {
  const match = name.match(/\b(\d{1,3})\s*\.?\s*hafta\s*program\s*\.(xls|xlsx)\b/i);
  return match ? Number(match[1]) : null;
}

export function selectLatestAskfFile(candidates: AskfFileCandidate[]): SelectedAskfFile {
  const eligible = candidates
    .map((candidate) => ({ ...candidate, week: weekFromName(candidate.name) }))
    .filter((candidate): candidate is SelectedAskfFile => candidate.week !== null && candidate.week > 0)
    .sort((a, b) => {
      if (a.week !== b.week) return b.week - a.week;
      const aIsXlsx = a.name.toLowerCase().includes('.xlsx');
      const bIsXlsx = b.name.toLowerCase().includes('.xlsx');
      return Number(bIsXlsx) - Number(aIsXlsx);
    });

  if (eligible.length === 0) {
    throw new Error('ASKF arşivinde haftalık program dosyası bulunamadı.');
  }

  return eligible[0];
}
