import { describe, it, expect } from 'vitest';
import { textWidthPx, paginateWords, subst } from './P10Canvas';

describe('textWidthPx', () => {
  it('returns correct width for single character at scale 1', () => {
    expect(textWidthPx('A', 1)).toBe(5);
  });

  it('returns correct width for single character at scale 2', () => {
    expect(textWidthPx('A', 2)).toBe(10);
  });

  it('includes inter-character spacing', () => {
    expect(textWidthPx('HI', 1)).toBe(11); // 5 + 1 + 5
  });

  it('handles multiple characters at scale 2', () => {
    expect(textWidthPx('HELLO', 2)).toBe(58); // (5*5 + 4*1) * 2
  });

  it('handles spaces (space contributes spacing, not CHAR_W)', () => {
    expect(textWidthPx('A B', 1)).toBe(12); // 5 + 1(sp) + 1(sp for space) + 1(sp) + 5
  });
});

describe('paginateWords', () => {
  it('returns single chunk when all words fit', () => {
    // "A B" at 2x = 24, fits in 60
    const chunks = paginateWords('A B', 60, 2);
    expect(chunks).toEqual(['A B']);
  });

  it('splits at word boundary when text overflows', () => {
    // "HELLO" at 2x = 58, fits in 60; "HELLO WORLD" = 96 > 60
    const chunks = paginateWords('HELLO WORLD', 60, 2);
    expect(chunks).toEqual(['HELLO', 'WORLD']);
  });

  it('puts overlength word in its own chunk', () => {
    // "SUPERLONG" at 2x = 10*9 + 8*2 = 106
    const chunks = paginateWords('SUPERLONG', 50, 2);
    expect(chunks).toEqual(['SUPERLONG']);
  });

  it('handles single word', () => {
    const chunks = paginateWords('HELLO', 60, 2);
    expect(chunks).toEqual(['HELLO']);
  });

  it('handles empty text', () => {
    const chunks = paginateWords('', 60, 2);
    expect(chunks).toEqual(['']);
  });

  it('splits multiple lines correctly', () => {
    // At 1x: "A B" = 12, fits 14; "A B C" = 19 > 14; "C D" = 12 ≤ 14
    const chunks = paginateWords('A B C D', 14, 1);
    expect(chunks).toEqual(['A B', 'C D']);
  });

  it('handles consecutive spaces', () => {
    const chunks = paginateWords('A   B', 60, 2);
    expect(chunks).toEqual(['A B']);
  });
});

describe('subst', () => {
  it('replaces {timer} case-insensitively', () => {
    expect(subst('Time: {timer}', { timer: '5:00' })).toBe('Time: 5:00');
    expect(subst('Time: {TIMER}', { timer: '5:00' })).toBe('Time: 5:00');
    expect(subst('Time: {Timer}', { timer: '5:00' })).toBe('Time: 5:00');
  });

  it('replaces {match_title}', () => {
    expect(subst('{match_title}', { match_title: 'Juan | 2v2' })).toBe('Juan | 2v2');
  });

  it('replaces multiple variables', () => {
    expect(subst('{next_match} - {next_wait}', { next_match: 'A vs B', next_wait: '5min' }))
      .toBe('A vs B - 5min');
  });

  it('leaves unknown variables unchanged', () => {
    expect(subst('{unknown_var} text', { timer: '1:00' })).toBe('{unknown_var} text');
  });

  it('handles text with no variables', () => {
    expect(subst('plain text', { timer: '1:00' })).toBe('plain text');
  });
});
