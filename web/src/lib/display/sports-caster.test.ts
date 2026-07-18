import { describe, it, expect } from 'vitest';
import { generatePayload } from './sports-caster';

describe('Sports Caster Payload Generator', () => {
  it('generates an OPEN payload when there is no current game', () => {
    const payload = generatePayload('court-1', { current: null, upcoming: [] });
    
    expect(payload.courtId).toBe('court-1');
    expect(payload.state).toBe('OPEN');
    // Default idle sequence: court_name, queue_count
    expect(payload.display.pages[0].text).toContain('court-1');
    expect(payload.display.pages[1].text).toContain('0 IN QUEUE');
    expect(payload.serverTime).toBeGreaterThan(1700000000);
  });

  it('generates a PLAYING payload with no queue', () => {
    const payload = generatePayload('court-1', {
      current: { name: 'Jane vs John', startTime: '2026-07-13T18:00:00Z', durationMinutes: 30 },
      upcoming: []
    });
    
    expect(payload.state).toBe('PLAYING');
    // Default game sequence: match_info, {timer} LEFT, queue_count
    expect(payload.display.pages[0].text).toBe('Jane vs John');
    expect(payload.display.pages[1].text).toBe('{timer} LEFT');
    expect(payload.display.pages[2].text).toContain('0 IN QUEUE');
  });

  it('includes serverTime and schedule metadata', () => {
    const payload = generatePayload('court-1', {
      current: { name: 'Test', startTime: '2026-07-13T18:00:00Z', durationMinutes: 30 },
      upcoming: []
    });
    
    expect(payload.serverTime).toBeGreaterThan(1700000000);
    expect(payload.schedule.current?.prepTimeSec).toBe(300);
    expect(payload.schedule.current?.startTimeEpoch).toBeGreaterThan(1700000000);
  });

  it('substitutes custom courtName and queueCount', () => {
    const payload = generatePayload('court-1', { current: null, upcoming: [] }, {
      courtName: 'Court A',
      queueCount: 5,
    });
    
    expect(payload.display.pages[0].text).toContain('Court A');
    expect(payload.display.pages[1].text).toContain('5 IN QUEUE');
  });
});
