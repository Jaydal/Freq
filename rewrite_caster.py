import re

with open('web/src/lib/display/sports-caster.ts', 'r') as f:
    content = f.read()

# We want to replace the `export function generatePayload` onwards
# with our new version.

replacement = """export function generatePayload(
  courtId: string,
  schedule: ScheduleData,
  opts?: {
    courtName?: string;
    queueCount?: number;
    displaySequence?: DisplaySequenceConfig;
    prepTimeSec?: number;
    nextName?: string;
    nextMatch?: string;
    nextWait?: string;
    nextBookedTime?: string;
    brightness?: number;
    rotation?: number;
  }
): DisplayPayload {
  const nowMs = Date.now();
  const serverTime = Math.floor(nowMs / 1000);
  const prepTimeSec = opts?.prepTimeSec ?? 300;
  const courtName = opts?.courtName ?? courtId;
  const queueCount = opts?.queueCount ?? 0;
  const sequence = opts?.displaySequence ?? DEFAULT_SEQUENCE;

  const blocks: import('../mqtt').DisplayBlock[] = [];

  function buildPages(
    c: any,
    state: 'OPEN' | 'PLAYING' | 'MAINTENANCE',
    section: DisplaySequenceSection | null
  ): DisplayPage[] {
    const pages: DisplayPage[] = [];
    const subVars: Record<string, string> = {
      court_name: courtName,
      match_info: c?.name ?? '',
      match_title: c?.matchTitle || c?.name || (state === 'PLAYING' ? 'IN GAME' : ''),
      match_type: c?.matchType ?? '',
      duration: c ? `${c.durationMinutes}min` : '',
      players: c?.players ?? '',
      queue_count: String(queueCount),
      next_name: opts?.nextName ?? '',
      next_match: opts?.nextMatch ?? '',
      next_wait: opts?.nextWait ?? '',
      next_booked_time: opts?.nextBookedTime ?? '',
    };

    const defaultColor = state === 'PLAYING' ? '#00FFFF' : '#00FF00';

    if (section) {
      for (const tpl of section.pages) {
        if (tpl.hideIfEmpty && tpl.hideIfEmpty.length > 0) {
          if (tpl.hideIfEmpty.every(k => !subVars[k])) continue;
        }
        if (tpl.showIfEmpty && tpl.showIfEmpty.length > 0) {
          if (tpl.showIfEmpty.some(k => subVars[k])) continue;
        }
        
        if (tpl.zones) {
          const pageDuration = tpl.durationSeconds ?? section.interval;
          const mappedZones = tpl.zones.map(zone => ({
            panelStart: zone.panelStart,
            panelEnd: zone.panelEnd,
            ...(zone.borderRows && zone.borderRows.length > 0 ? { borderRows: zone.borderRows } : {}),
            ...(zone.scale ? { scale: zone.scale } : {}),
            ...(zone.valign && zone.valign !== 'middle' ? { valign: zone.valign } : {}),
            lines: zone.lines.map(line => {
              if (line.subpages && line.subpages.length > 0) {
                return {
                  subpages: line.subpages.map(sp => ({
                    text: substituteVars(sp.text, subVars),
                    color: sp.color,
                    effect: sp.effect === 'paginate' ? 'STATIC' : sp.effect,
                    ...(sp.align && sp.align !== 'center' ? { align: sp.align } : {}),
                    ...(sp.scrollSpeed != null && sp.scrollSpeed !== 1 ? { scrollSpeed: sp.scrollSpeed } : {}),
                    durationMs: sp.durationMs,
                  })),
                  ...(line.marginTop != null && line.marginTop !== 0 ? { marginTop: line.marginTop } : {}),
                  ...(line.marginBottom != null && line.marginBottom !== 2 ? { marginBottom: line.marginBottom } : {}),
                };
              }
              const rawText = substituteVars(line.text, subVars);
              const eff = line.effect || 'SCROLL';
              return {
                subpages: [{
                  text: rawText,
                  color: line.color || defaultColor,
                  effect: eff === 'paginate' ? 'STATIC' : eff,
                  ...(line.align && line.align !== 'center' ? { align: line.align } : {}),
                  ...(line.scrollSpeed != null && line.scrollSpeed !== 1 ? { scrollSpeed: line.scrollSpeed } : {}),
                  durationMs: pageDuration * 1000,
                }],
                ...(line.marginTop != null && line.marginTop !== 0 ? { marginTop: line.marginTop } : {}),
                ...(line.marginBottom != null && line.marginBottom !== 2 ? { marginBottom: line.marginBottom } : {}),
              };
            }),
          }));
          pages.push({ zones: mappedZones, durationSeconds: pageDuration });
        } else {
          const raw = tpl.text ?? tpl.line1 ?? '';
          const text = substituteVars(raw, subVars);
          const eff = (tpl.effect ?? 'SCROLL');
          pages.push({
            text,
            color: tpl.color ?? defaultColor,
            effect: eff === 'paginate' ? 'SCROLL' : eff as any,
            durationSeconds: tpl.durationSeconds ?? section.interval,
          });
        }
      }
    }
    return pages;
  }

  let nextStartEpoch = serverTime;

  if (schedule.maintenance) {
    const pages: DisplayPage[] = [{
      text: `${courtName} CLOSED FOR MAINTENANCE`,
      color: "#FF0000",
      effect: "SCROLL",
      durationSeconds: 10
    }];
    blocks.push({ startEpoch: 0, endEpoch: 2147483647, pages });
  } else {
    // Current Game Block
    if (schedule.current) {
      const c = schedule.current;
      const cStart = Math.floor(new Date(c.startTime).getTime() / 1000);
      const startEpoch = isNaN(cStart) ? serverTime : cStart;
      const endEpoch = startEpoch + prepTimeSec + c.durationMinutes * 60;
      
      blocks.push({
        startEpoch,
        endEpoch,
        pages: buildPages(c, 'PLAYING', sequence.game)
      });
      nextStartEpoch = endEpoch;
    }

    // Upcoming Games Blocks
    if (schedule.upcoming && schedule.upcoming.length > 0) {
      for (const u of schedule.upcoming) {
        const uDur = (u as any).durationMinutes || 30; // fallback to 30 min
        const startEpoch = nextStartEpoch;
        const endEpoch = startEpoch + prepTimeSec + uDur * 60;
        
        blocks.push({
          startEpoch,
          endEpoch,
          pages: buildPages(u, 'PLAYING', sequence.game) // Use PLAYING so it renders as a game
        });
        nextStartEpoch = endEpoch;
      }
    }

    // Idle Block at the end
    blocks.push({
      startEpoch: nextStartEpoch,
      endEpoch: 2147483647,
      pages: buildPages(null, 'OPEN', sequence.idle)
    });
  }

  const mappedSchedule = {
    current: schedule.current
      ? {
          name: schedule.current.name,
          startTime: schedule.current.startTime,
          startTimeEpoch: (() => {
            const t = Math.floor(new Date(schedule.current.startTime).getTime() / 1000);
            return isNaN(t) ? serverTime : t;
          })(),
          durationMinutes: schedule.current.durationMinutes,
          prepTimeSec,
        }
      : null,
    upcoming: schedule.upcoming,
  };

  return {
    courtId,
    action: 'QUEUE_UPDATE',
    state: schedule.maintenance ? 'MAINTENANCE' : (schedule.current ? 'PLAYING' : 'OPEN'),
    schedule: mappedSchedule,
    serverTime,
    ...(opts?.brightness != null ? { brightness: opts.brightness } : {}),
    ...(opts?.rotation != null ? { rotation: opts.rotation } : {}),
    blocks
  };
}
"""

start_idx = content.find('export function generatePayload')
if start_idx == -1:
    print("Could not find generatePayload")
else:
    new_content = content[:start_idx] + replacement
    with open('web/src/lib/display/sports-caster.ts', 'w') as f:
        f.write(new_content)
    print("Rewritten sports-caster.ts")
