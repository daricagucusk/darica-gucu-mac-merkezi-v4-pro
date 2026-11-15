import { useCallback, useEffect, useState } from 'react';
import type { PublicPlayer } from '../players/model';
import { resizePhotoToJpeg } from './player-photo-utils';
import './player-manager.css';

type Props = {
  /** Afişte MVP olarak kullanılacak oyuncu kimliği (Hikaye C). */
  selectedId: string | null;
  onSelect: (player: PublicPlayer | null) => void;
  /** Liste yüklenince/değişince üst bileşene bildirilir. */
  onPlayers?: (players: PublicPlayer[]) => void;
};

const TEAMS = ['U-11', 'U-12', 'U-13', 'U-14', 'U-15', 'U-16', 'U-17', 'U-18', 'U-19'];

type Draft = { id: string; number: string; name: string; position: string; team: string };
const EMPTY: Draft = { id: '', number: '', name: '', position: '', team: 'U-14' };

async function errorText(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json() as { error?: unknown };
    if (typeof data?.error === 'string' && data.error) return data.error;
  } catch { /* gövde JSON değil */ }
  return fallback;
}

function Avatar({ player }: { player: PublicPlayer }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [player.id, player.updatedAt, player.hasPhoto]);
  if (player.hasPhoto && !failed) {
    return <img className="pm-avatar" alt="" src={`/api/player-photo?id=${encodeURIComponent(player.id)}&v=${encodeURIComponent(player.updatedAt)}`} onError={() => setFailed(true)}/>;
  }
  return <span className="pm-avatar pm-avatar-number" aria-hidden="true">{player.number}</span>;
}

export default function PlayerManager({ selectedId, onSelect, onPlayers }: Props) {
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const apply = useCallback((next: PublicPlayer[]) => {
    setPlayers(next);
    onPlayers?.(next);
  }, [onPlayers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/players', { cache: 'no-store' });
      if (!response.ok) throw new Error(await errorText(response, 'Oyuncu listesi alınamadı.'));
      const data = await response.json() as { players?: PublicPlayer[] } | null;
      apply(Array.isArray(data?.players) ? data.players : []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Oyuncu listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('save'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id || undefined, number: draft.number, name: draft.name, position: draft.position, team: draft.team,
        }),
      });
      if (!response.ok) throw new Error(await errorText(response, 'Oyuncu kaydedilemedi.'));
      const data = await response.json() as { player: PublicPlayer };
      apply(draft.id ? players.map((p) => (p.id === data.player.id ? data.player : p)) : [...players, data.player]);
      setMessage(draft.id ? 'Oyuncu güncellendi.' : 'Oyuncu eklendi.');
      setDraft(EMPTY);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Oyuncu kaydedilemedi.');
    } finally {
      setBusy('');
    }
  }

  async function remove(player: PublicPlayer) {
    if (!window.confirm(`${player.name} (${player.team} · ${player.number}) silinsin mi? Fotoğrafı da silinir.`)) return;
    setBusy(player.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/players?id=${encodeURIComponent(player.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await errorText(response, 'Oyuncu silinemedi.'));
      apply(players.filter((p) => p.id !== player.id));
      if (selectedId === player.id) onSelect(null);
      if (draft.id === player.id) setDraft(EMPTY);
      setMessage('Oyuncu silindi.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Oyuncu silinemedi.');
    } finally {
      setBusy('');
    }
  }

  async function uploadPhoto(player: PublicPlayer, file: File | undefined) {
    if (!file) return;
    setBusy(player.id); setError(''); setMessage('');
    try {
      const jpeg = await resizePhotoToJpeg(file);
      const response = await fetch(`/api/player-photo?id=${encodeURIComponent(player.id)}`, {
        method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg,
      });
      if (!response.ok) throw new Error(await errorText(response, 'Fotoğraf yüklenemedi.'));
      const updated = { ...player, hasPhoto: true, updatedAt: new Date().toISOString() };
      apply(players.map((p) => (p.id === player.id ? updated : p)));
      if (selectedId === player.id) onSelect(updated);
      setMessage('Fotoğraf yüklendi.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Fotoğraf yüklenemedi.');
    } finally {
      setBusy('');
    }
  }

  async function removePhoto(player: PublicPlayer) {
    if (!window.confirm(`${player.name} fotoğrafı silinsin mi?`)) return;
    setBusy(player.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/player-photo?id=${encodeURIComponent(player.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await errorText(response, 'Fotoğraf silinemedi.'));
      const updated = { ...player, hasPhoto: false, updatedAt: new Date().toISOString() };
      apply(players.map((p) => (p.id === player.id ? updated : p)));
      if (selectedId === player.id) onSelect(updated);
      setMessage('Fotoğraf silindi.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Fotoğraf silinemedi.');
    } finally {
      setBusy('');
    }
  }

  const sorted = [...players].sort((a, b) => a.team.localeCompare(b.team) || a.number - b.number);

  return (
    <section className="pm" aria-labelledby="pm-title">
      <div className="pm-head">
        <div>
          <h3 id="pm-title">Oyuncular &amp; MVP</h3>
          <p>Hikaye C için maçın oyuncusunu seç. Fotoğraf yoksa forma numarası gösterilir.</p>
        </div>
        <span className="pm-count">{players.length} oyuncu</span>
      </div>

      {loading && <p className="pm-note">Oyuncu listesi yükleniyor…</p>}
      {!loading && sorted.length === 0 && !error && <p className="pm-note">Henüz oyuncu yok. Aşağıdan ilk oyuncuyu ekle.</p>}

      <ul className="pm-list">
        {sorted.map((player) => (
          <li key={player.id} className={`pm-row${selectedId === player.id ? ' is-selected' : ''}`}>
            <Avatar player={player}/>
            <div className="pm-who">
              <strong>{player.name}</strong>
              <span>#{player.number} · {player.position || 'Mevki yok'} · {player.team}</span>
            </div>
            <div className="pm-actions">
              <button type="button" className={selectedId === player.id ? 'pm-btn pm-btn-on' : 'pm-btn'} aria-pressed={selectedId === player.id}
                onClick={() => onSelect(selectedId === player.id ? null : player)}>{selectedId === player.id ? 'MVP seçili' : 'MVP seç'}</button>
              <label className={`pm-btn pm-file${busy === player.id ? ' is-busy' : ''}`}>
                <span>Fotoğraf</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy === player.id}
                  onChange={(event) => { void uploadPhoto(player, event.target.files?.[0]); event.target.value = ''; }}/>
              </label>
              {player.hasPhoto && <button type="button" className="pm-btn" disabled={busy === player.id} onClick={() => void removePhoto(player)}>Fotoğrafı sil</button>}
              <button type="button" className="pm-btn" disabled={busy === player.id}
                onClick={() => setDraft({ id: player.id, number: String(player.number), name: player.name, position: player.position, team: player.team })}>Düzenle</button>
              <button type="button" className="pm-btn pm-btn-danger" disabled={busy === player.id} onClick={() => void remove(player)}>Sil</button>
            </div>
          </li>
        ))}
      </ul>

      <form className="pm-form" onSubmit={(event) => void save(event)}>
        <h4>{draft.id ? 'Oyuncuyu düzenle' : 'Yeni oyuncu ekle'}</h4>
        <div className="pm-grid">
          <label><span>Forma no</span>
            <input inputMode="numeric" type="number" min="1" max="99" required value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })}/></label>
          <label><span>Takım</span>
            <select value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value })}>{TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label className="pm-wide"><span>Ad Soyad</span>
            <input required maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ad Soyad"/></label>
          <label className="pm-wide"><span>Mevki</span>
            <input maxLength={24} value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} placeholder="Örn. Orta saha"/></label>
        </div>
        <div className="pm-form-actions">
          <button type="submit" className="pm-submit" disabled={busy === 'save'}>{draft.id ? 'Güncelle' : 'Oyuncu ekle'}</button>
          {draft.id && <button type="button" className="pm-btn" onClick={() => setDraft(EMPTY)}>Vazgeç</button>}
        </div>
      </form>

      {error && <p className="pm-error" role="alert">{error}</p>}
      {message && <p className="pm-ok" role="status">{message}</p>}
    </section>
  );
}
