import { del } from '@vercel/blob';
import { readJSON, writeJSON } from './blob-store.js';
import { parseRoster, type Player } from '../../src/players/model.js';

export const PATH_PLAYERS_ROSTER = 'players/roster.json';

export async function readRoster(): Promise<Player[]> {
  return parseRoster(await readJSON<{ players?: unknown }>(PATH_PLAYERS_ROSTER));
}

export async function writeRoster(players: Player[]): Promise<void> {
  await writeJSON(PATH_PLAYERS_ROSTER, { schema: 1, players });
}

/** Eski fotoğraf blob'unu en iyi çabayla kaldırır; hata oyuncu işlemini bozmaz. */
export async function deletePhotoBlob(photoKey: string | undefined): Promise<void> {
  if (!photoKey || !photoKey.startsWith('players/photos/')) return;
  try {
    await del(photoKey);
  } catch {
    // Yetim blob zararsızdır; içerik loglanmaz.
  }
}
