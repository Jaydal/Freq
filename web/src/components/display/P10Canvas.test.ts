import { describe, it, expect } from 'vitest';
import { textWidthPx, subst } from './P10Canvas';

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

  it('handles spaces (space contributes SPACING width)', () => {
    expect(textWidthPx('A B', 1)).toBe(13); // 5 + (1+1) + (1+5)
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