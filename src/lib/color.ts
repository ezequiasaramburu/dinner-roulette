/** Blend two 6-digit hex colours: `amount` 0 gives `from`, 1 gives `to`. Used to derive soft shades from theme colours. */
export function mix(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function channels(hex: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`expected a 6-digit hex colour, got "${hex}"`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
