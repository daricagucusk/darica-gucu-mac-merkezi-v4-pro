import { describe, expect, it } from 'vitest';
import { fitWithin } from './player-photo-utils';

describe('fitWithin', () => {
  it('uzun kenarı 600 px yapar, oranı korur', () => {
    expect(fitWithin(3000, 1500)).toEqual({ width: 600, height: 300 });
    expect(fitWithin(1200, 4800)).toEqual({ width: 150, height: 600 });
  });
  it('küçük görseli büyütmez', () => {
    expect(fitWithin(400, 300)).toEqual({ width: 400, height: 300 });
  });
  it('geçersiz boyutta sıfır döner', () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});
