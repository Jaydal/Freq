export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

export const PRESET_COLORS = [
  '#00FF00',
  '#00FFFF',
  '#FF0000',
  '#FFFF00',
  '#FFFFFF',
  '#FF00FF',
  '#FF8800',
  '#0088FF',
];
