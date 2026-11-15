import { describe, expect, it } from 'vitest';
import {
  containsSensitivePattern, isSafePlayerId, MAX_PHOTO_BYTES, normalizeTeam, parseRoster, photoKeyFor,
  removePlayer, toPublicPlayer, upsertPlayer, validatePhoto, validatePlayerInput, type Player,
} from './model';

const NOW = new Date('2026-11-15T10:00:00Z');
let n = 0;
const newId = () => `id-test-${++n}`;
const base = { number: 10, name: 'Test Oyuncu', position: 'Orta Saha', team: 'U-15' };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('oyuncu doğrulama', () => {
  it('geçerli girdiyi normalize eder', () => {
    const r = validatePlayerInput({ ...base, name: '  Test   Oyuncu ', team: 'u15', number: '7' });
    expect(r).toEqual({ ok: true, value: { number: 7, name: 'Test Oyuncu', position: 'Orta Saha', team: 'U-15' } });
  });
  it('boş ad, geçersiz numara ve takımı reddeder', () => {
    expect(validatePlayerInput({ ...base, name: '  ' }).ok).toBe(false);
    for (const number of [0, 100, 1.5, 'x', null, '007']) expect(validatePlayerInput({ ...base, number }).ok).toBe(false);
    expect(validatePlayerInput({ ...base, team: 'U-10' }).ok).toBe(false);
    expect(validatePlayerInput({ ...base, team: 'A Takım' }).ok).toBe(false);
  });
  it('TC, IBAN ve telefon benzeri metni reddeder', () => {
    expect(containsSensitivePattern('12345678901')).toBe(true);
    expect(containsSensitivePattern('TR33 0006 1005 1978 6457 8413 26')).toBe(true);
    expect(containsSensitivePattern('0532 123 45 67')).toBe(true);
    expect(containsSensitivePattern('Orta Saha 10 numara')).toBe(false);
    expect(validatePlayerInput({ ...base, position: '12345678901' }).ok).toBe(false);
    expect(validatePlayerInput({ ...base, name: 'Ali TR330006100519786457841326' }).ok).toBe(false);
  });
});

describe('oyuncu listesi', () => {
  it('aynı takımda aynı forma numarasını reddeder, başka takıma izin verir', () => {
    const a = upsertPlayer([], base, NOW, newId);
    if (!a.ok) throw new Error('beklenmedik');
    expect(upsertPlayer(a.value.roster, { ...base, name: 'Başka' }, NOW, newId).ok).toBe(false);
    expect(upsertPlayer(a.value.roster, { ...base, name: 'Başka', team: 'U-17' }, NOW, newId).ok).toBe(true);
  });
  it('güncellemede kendi numarasını korur; photoKey istemciden alınmaz ve korunur', () => {
    const seed: Player = { id: 'id-seed-1', number: 5, name: 'A', position: '', team: 'U-13', photoKey: 'players/photos/x.jpg', updatedAt: 'x' };
    const r = upsertPlayer([seed], { id: 'id-seed-1', number: 5, name: 'A2', team: 'U-13', photoKey: 'EVIL' } as never, NOW, newId);
    if (!r.ok) throw new Error('beklenmedik');
    expect(r.value.player.photoKey).toBe('players/photos/x.jpg');
    expect(r.value.player.name).toBe('A2');
    expect(r.value.player.updatedAt).toBe(NOW.toISOString());
    expect(upsertPlayer([seed], { ...base, id: 'yok-yok-yok' }, NOW, newId).ok).toBe(false);
  });
  it('istemci görünümünde photoKey yoktur', () => {
    const pub = toPublicPlayer({ id: 'a', number: 1, name: 'A', position: '', team: 'U-11', photoKey: 'players/photos/a-1.jpg', updatedAt: 't' });
    expect(pub.hasPhoto).toBe(true);
    expect(JSON.stringify(pub)).not.toContain('players/photos');
  });
  it('siler ve bozuk blob verisini ayıklar', () => {
    const p: Player = { id: 'a', number: 1, name: 'A', position: '', team: 'U-11', updatedAt: 't' };
    expect(removePlayer([p], 'a')).toEqual({ roster: [], removed: p });
    expect(removePlayer([p], 'b').removed).toBeNull();
    expect(parseRoster({ players: [p, null, { id: 3 }] })).toEqual([p]);
    expect(parseRoster(null)).toEqual([]);
  });
});

describe('fotoğraf doğrulama', () => {
  it('JPEG kabul, yanlış tür/imza/boyut ret', () => {
    expect(validatePhoto('image/jpeg', jpeg).ok).toBe(true);
    expect(validatePhoto('image/gif', jpeg).ok).toBe(false);
    expect(validatePhoto('image/png', jpeg).ok).toBe(false);
    expect(validatePhoto('image/jpeg', new Uint8Array(0)).ok).toBe(false);
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(jpeg);
    expect(validatePhoto('image/jpeg', big).ok).toBe(false);
  });
  it('kimlik ve anahtar biçimi', () => {
    expect(isSafePlayerId('../etc')).toBe(false);
    expect(isSafePlayerId('id-test-1')).toBe(true);
    expect(photoKeyFor('id-test-1', 'abcdef0123456789ffff')).toBe('players/photos/id-test-1-abcdef0123456789.jpg');
    expect(photoKeyFor('id-test-1', 'abcdef0123456789ffff', 'image/png')).toBe('players/photos/id-test-1-abcdef0123456789.png');
    expect(photoKeyFor('id-test-1', 'abcdef0123456789ffff', 'image/webp')).toBe('players/photos/id-test-1-abcdef0123456789.webp');
    expect(normalizeTeam('U 19')).toBe('U-19');
  });
});
