// Oyuncu modeli: doğrulama ve normalize. Kişisel kimlik alanı (TC/IBAN/telefon) bilinçli olarak YOK.
export interface Player {
  id: string;
  number: number;
  name: string;
  position: string;
  team: string; // 'U-11' .. 'U-19'
  photoKey?: string; // yalnız sunucuda; istemciye gitmez
  updatedAt: string;
}

export interface PlayerInput {
  id?: unknown;
  number?: unknown;
  name?: unknown;
  position?: unknown;
  team?: unknown;
}

export interface PublicPlayer {
  id: string;
  number: number;
  name: string;
  position: string;
  team: string;
  hasPhoto: boolean;
  updatedAt: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_PLAYERS = 300;

/** Serbest metinde TC (11 hane), IBAN veya telefon benzeri uzun rakam dizisi var mı. */
export function containsSensitivePattern(text: string): boolean {
  const compact = text.replace(/[\s.\-_/()+]/g, '');
  if (/\d{10,}/.test(compact)) return true; // TC kimlik, telefon, kart no
  if (/[a-z]{2}\d{2}[a-z0-9]{11,30}/i.test(compact) && /\d{4}/.test(compact)) return true; // IBAN
  return false;
}

export function normalizeTeam(value: unknown): string | null {
  const match = String(value ?? '').trim().toUpperCase().match(/^U\s*[-–]?\s*(1[1-9])$/);
  return match ? `U-${match[1]}` : null;
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max + 1);
}

export function validatePlayerInput(input: PlayerInput): ValidationResult<Omit<Player, 'id' | 'updatedAt' | 'photoKey'>> {
  const name = cleanText(input.name, 60);
  if (!name) return { ok: false, error: 'Ad boş olamaz.' };
  if (name.length > 60) return { ok: false, error: 'Ad en fazla 60 karakter olabilir.' };
  const position = cleanText(input.position, 24);
  if (position.length > 24) return { ok: false, error: 'Mevki en fazla 24 karakter olabilir.' };
  const raw = input.number;
  const number = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{1,2}$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isInteger(number) || number < 1 || number > 99) return { ok: false, error: 'Forma numarası 1-99 olmalı.' };
  const team = normalizeTeam(input.team);
  if (!team) return { ok: false, error: 'Takım U-11 ile U-19 arasında olmalı.' };
  if (containsSensitivePattern(name) || containsSensitivePattern(position)) {
    return { ok: false, error: 'Kişisel kimlik, IBAN veya telefon benzeri veri kabul edilmez.' };
  }
  return { ok: true, value: { number, name, position, team } };
}

/** Ekle/güncelle. Aynı takımda aynı forma numarası (başka oyuncuda) reddedilir. photoKey istemciden alınmaz. */
export function upsertPlayer(
  roster: Player[],
  input: PlayerInput,
  now: Date,
  newId: () => string,
): ValidationResult<{ roster: Player[]; player: Player }> {
  const checked = validatePlayerInput(input);
  if (!checked.ok) return checked;
  const id = typeof input.id === 'string' && input.id ? input.id : null;
  const existing = id ? roster.find((p) => p.id === id) : undefined;
  if (id && !existing) return { ok: false, error: 'Oyuncu bulunamadı.' };
  if (roster.some((p) => p.id !== existing?.id && p.team === checked.value.team && p.number === checked.value.number)) {
    return { ok: false, error: `${checked.value.team} takımında ${checked.value.number} numara zaten kullanılıyor.` };
  }
  if (!existing && roster.length >= MAX_PLAYERS) return { ok: false, error: 'Oyuncu sınırına ulaşıldı.' };
  const player: Player = {
    ...(existing ?? {}),
    ...checked.value,
    id: existing?.id ?? newId(),
    updatedAt: now.toISOString(),
  };
  const next = existing ? roster.map((p) => (p.id === player.id ? player : p)) : [...roster, player];
  return { ok: true, value: { roster: next, player } };
}

export function removePlayer(roster: Player[], id: string): { roster: Player[]; removed: Player | null } {
  const removed = roster.find((p) => p.id === id) ?? null;
  return { roster: removed ? roster.filter((p) => p.id !== id) : roster, removed };
}

export function toPublicPlayer(player: Player): PublicPlayer {
  return {
    id: player.id,
    number: player.number,
    name: player.name,
    position: player.position,
    team: player.team,
    hasPhoto: Boolean(player.photoKey),
    updatedAt: player.updatedAt,
  };
}

/** Blob'dan gelen ham veriyi savunmacı biçimde oyuncu listesine çevirir. */
export function parseRoster(raw: unknown): Player[] {
  const list = (raw as { players?: unknown } | null)?.players;
  if (!Array.isArray(list)) return [];
  return list.filter((p): p is Player => !!p && typeof p.id === 'string' && Number.isInteger(p.number) &&
    typeof p.name === 'string' && typeof p.team === 'string');
}

// --- Fotoğraf ---
export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type PhotoType = (typeof PHOTO_TYPES)[number];

/** Gerçek bayt imzasından görsel türü. */
export function sniffImageType(bytes: Uint8Array): PhotoType | null {
  if (bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 12 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

export function validatePhoto(declaredType: string, bytes: Uint8Array): ValidationResult<{ contentType: PhotoType }> {
  const type = declaredType.split(';')[0].trim().toLowerCase();
  if (!(PHOTO_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'Yalnız JPEG, PNG veya WebP kabul edilir.' };
  if (bytes.length === 0) return { ok: false, error: 'Fotoğraf boş.' };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: 'Fotoğraf en fazla 1,5 MB olabilir.' };
  if (sniffImageType(bytes) !== type) return { ok: false, error: 'Dosya içeriği bildirilen türle uyuşmuyor.' };
  return { ok: true, value: { contentType: type as PhotoType } };
}

export function isSafePlayerId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9-]{6,40}$/.test(id);
}

const PHOTO_EXT: Record<PhotoType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function photoKeyFor(id: string, hashHex: string, contentType: PhotoType = 'image/jpeg'): string {
  return `players/photos/${id}-${hashHex.slice(0, 16)}.${PHOTO_EXT[contentType]}`;
}
