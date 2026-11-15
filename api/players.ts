import { randomUUID } from 'node:crypto';
import { setNoStoreHeaders, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { assertSameOrigin, readJsonBody } from './_lib/request-security.js';
import { deletePhotoBlob, readRoster, writeRoster } from './_lib/players-store.js';
import { isSafePlayerId, removePlayer, toPublicPlayer, upsertPlayer, type PlayerInput } from '../src/players/model.js';

// Yalnız id ve sayı loglanır; ad/foto içeriği asla.
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  setNoStoreHeaders(res);
  try {
    if (req.method === 'GET') {
      const roster = await readRoster();
      res.status(200).json({ players: roster.map(toPublicPlayer) });
      return;
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      assertSameOrigin(req);
    } catch {
      res.status(403).json({ error: 'İstek aynı kaynaktan gelmiyor.' });
      return;
    }

    const roster = await readRoster();
    if (req.method === 'POST') {
      let body: PlayerInput;
      try {
        body = await readJsonBody<PlayerInput>(req);
      } catch {
        res.status(400).json({ error: 'İstek gövdesi geçersiz.' });
        return;
      }
      const result = upsertPlayer(roster, body, new Date(), () => randomUUID());
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      await writeRoster(result.value.roster);
      console.info(`players: upsert id=${result.value.player.id} count=${result.value.roster.length}`);
      res.status(200).json({ player: toPublicPlayer(result.value.player) });
      return;
    }

    const id = new URL(req.url ?? '/', 'http://localhost').searchParams.get('id');
    if (!isSafePlayerId(id)) {
      res.status(400).json({ error: 'Geçersiz oyuncu kimliği.' });
      return;
    }
    const { roster: next, removed } = removePlayer(roster, id);
    if (!removed) {
      res.status(404).json({ error: 'Oyuncu bulunamadı.' });
      return;
    }
    await writeRoster(next);
    await deletePhotoBlob(removed.photoKey);
    console.info(`players: delete id=${id} count=${next.length}`);
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Oyuncu verisi işlenemedi.' });
  }
}
