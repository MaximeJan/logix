import { describe, it, expect } from 'vitest';
import { formatBitsGrouped } from '../src/lib/bits';

describe('formatBitsGrouped', () => {
  it('groupe par 4 bits, MSB à gauche', () => {
    expect(formatBitsGrouped(0xa5, 8)).toBe('1010 0101');
    expect(formatBitsGrouped(0, 8)).toBe('0000 0000');
    expect(formatBitsGrouped(0xff, 8)).toBe('1111 1111');
  });
  it('largeur non multiple de 4 : groupe partiel à gauche', () => {
    expect(formatBitsGrouped(0b101010, 6)).toBe('10 1010');
    expect(formatBitsGrouped(0, 6)).toBe('00 0000');
  });
  it('1 bit', () => {
    expect(formatBitsGrouped(1, 1)).toBe('1');
    expect(formatBitsGrouped(0, 1)).toBe('0');
  });
  it('masque la valeur à la largeur', () => {
    expect(formatBitsGrouped(0x1ff, 8)).toBe('1111 1111'); // 0x1FF & 0xFF
    expect(formatBitsGrouped(0b1_0001, 4)).toBe('0001'); // débordement tronqué
  });
  it('normalise les entrées non entières (asInt)', () => {
    expect(formatBitsGrouped(true, 4)).toBe('0001');
    expect(formatBitsGrouped(null, 4)).toBe('0000');
  });
});
