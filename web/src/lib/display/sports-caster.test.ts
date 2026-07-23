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

  it('passes through new per-line fields in zone payloads', () => {
    const payload = generatePayload('court-1', { current: null, upcoming: [] }, {
      displaySequence: {
        idle: { interval: 10, pages: [{
          zones: [{
            panelStart: 0,
            panelEnd: 2,
            lines: [{
              text: 'test',
              color: '#00FF00',
              effect: 'SCROLL',
              align: 'left',
              scrollSpeed: 2,
              marginTop: 1,
              marginBottom: 3,
            }],
          }],
        }] },
        prep: { interval: 10, pages: [] },
        game: { interval: 10, pages: [] },
      },
    });

    const zone = payload.display.pages[0].zones?.[0];
    expect(zone).toBeDefined();
    expect(zone!.lines[0].subpages[0].scrollSpeed).toBe(2);
    expect(zone!.lines[0].marginTop).toBe(1);
    expect(zone!.lines[0].marginBottom).toBe(3);
    expect(zone!.lines[0].subpages[0].align).toBe('left');
  });

  it('substitutes nextWait and nextBookedTime in custom sequences', () => {
    const payload = generatePayload('court-1', { current: null, upcoming: [] }, {
      nextWait: '5min',
      nextBookedTime: '2:30PM',
      displaySequence: {
        idle: { interval: 10, pages: [
          { text: 'Wait: {next_wait}' },
          { text: 'Next: {next_booked_time}' },
        ] },
        prep: { interval: 10, pages: [] },
        game: { interval: 10, pages: [] },
      },
    });

    expect(payload.display.pages[0].text).toBe('Wait: 5min');
    expect(payload.display.pages[1].text).toBe('Next: 2:30PM');
  });
});
