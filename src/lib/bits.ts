import { asInt, maskTo } from './sim';

// Formate `v` masqué à `width` bits en binaire groupé par 4, MSB à gauche.
// Ex : width=8, v=0xA5 → "1010 0101".
export function formatBitsGrouped(v: unknown, width: number): string {
  const bin = maskTo(width, asInt(v)).toString(2).padStart(width, '0');
  const groups: string[] = [];
  // Découpe depuis la droite (LSB) pour grouper proprement, puis on inverse.
  for (let i = bin.length; i > 0; i -= 4) {
    groups.unshift(bin.slice(Math.max(0, i - 4), i));
  }
  return groups.join(' ');
}
