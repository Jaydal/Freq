import { DisplayPayload, DisplayPage } from '../mqtt';

export interface ScheduleData {
  maintenance?: boolean;
  current?: {
    name: string;
    startTime: string;
    durationMinutes: number;
    matchTitle?: string;
    matchType?: string;
    players?: string;
  } | null;
  upcoming: { name: string; startTime?: string; durationMinutes?: number }[];
}

export interface DisplaySequenceSection {
  interval: number;
  pages: {
    text?: string;
    line1?: string;
    color?: string;
    effect?: string;
    durationSeconds?: number;
    hideIfEmpty?: string[];
    showIfEmpty?: string[];
    zones?: {
      panelStart: number;
      panelEnd: number;
      borderRows?: { start: number; end: number }[];
      scaleX?: number;
      scaleY?: number;
      valign?: string;
      lines: { text: string; color: string; bgColor?: string; font?: string; bold?: boolean; scaleX?: number; scaleY?: number; spacing?: number; effect: string; align?: string; scrollSpeed?: number; marginTop?: number; marginBottom?: number; rules?: { type: string; operator: '<' | '>'; value: number; color?: string; effect?: string }[]; subpages?: { text: string; color: string; bgColor?: string; font?: string; bold?: boolean; effect: string; align?: string; scrollSpeed?: number; durationMs: number }[] }[];
    }[];
  }[];
}

export interface DisplaySequenceConfig {
  idle: DisplaySequenceSection;
  game: DisplaySequenceSection;
}

const DEFAULT_SEQUENCE: DisplaySequenceConfig = {
  idle: { interval: 10, pages: [{ text: "{court_name}" }, { text: "UP NEXT: {next_match}", color: "#FFFF00", hideIfEmpty: ["{next_match}"] }] },
  game: { interval: 10, pages: [{ text: "{match_title}" }, { text: "{timer}" }] },
};


const CHAR_W = 5;
const SPACING = 1;
function textWidthPx(text: string, scale: number) {
  let w = 0;
  let first = true;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') {
      if (!first) w += SPACING * scale;
      w += CHAR_W * scale;
      first = false;
    }
  }
  return w;
}

function substituteVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, val);
  }
  return result;
}

export function generatePayload(
  courtId: string,
  schedule: ScheduleData,
  opts?: {
    courtName?: string;
    queueCount?: number;
    displaySequence?: DisplaySequenceConfig;
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
  const courtName = opts?.courtName ?? courtId;
  const queueCount = opts?.queueCount ?? 0;
  const rawSeq = opts?.displaySequence;
  const idleSection: DisplaySequenceSection | undefined =
    rawSeq?.idle || (rawSeq as any)?.sections?.idle;
  const gameSection: DisplaySequenceSection | undefined =
    rawSeq?.game || (rawSeq as any)?.sections?.game;

  const sequence = {
    idle: idleSection ?? DEFAULT_SEQUENCE.idle,
    game: gameSection ?? DEFAULT_SEQUENCE.game,
  };

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
      match_title: c?.matchTitle || c?.name || '',
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
          if (tpl.hideIfEmpty.every(k => !subVars[k.replace(/[{}]/g, '')])) continue;
        }
        if (tpl.showIfEmpty && tpl.showIfEmpty.length > 0) {
          if (tpl.showIfEmpty.some(k => subVars[k.replace(/[{}]/g, '')])) continue;
        }
        
        if (tpl.zones) {
          const pageDuration = tpl.durationSeconds ?? section.interval;
          const mappedZones = tpl.zones.map(zone => ({
            panelStart: zone.panelStart,
            panelEnd: zone.panelEnd,
            ...(zone.borderRows && zone.borderRows.length > 0 ? { borderRows: zone.borderRows } : {}),
            ...(zone.scaleX ? { scaleX: zone.scaleX } : {}),
            ...(zone.scaleY ? { scaleY: zone.scaleY } : {}),
            ...(zone.valign && zone.valign !== 'middle' ? { valign: zone.valign } : {}),
            lines: zone.lines.map(line => {
              const lineFont = line.font || line.subpages?.[0]?.font;
              if (line.subpages && line.subpages.length > 0) {
                return {
                  subpages: line.subpages.map(sp => ({
                    text: substituteVars(sp.text, subVars),
                    color: sp.color,
                    ...(sp.bgColor ? { bgColor: sp.bgColor } : {}),
                    effect: sp.effect === 'paginate' ? 'STATIC' : sp.effect,
                    ...(sp.align && sp.align !== 'center' ? { align: sp.align } : {}),
                    ...(sp.scrollSpeed != null && sp.scrollSpeed !== 1 ? { scrollSpeed: sp.scrollSpeed } : {}),
                    ...(sp.font || lineFont ? { font: sp.font || lineFont } : {}),
                    ...(sp.bold ? { bold: sp.bold } : {}),
                    durationMs: sp.durationMs,
                  })),
                  ...(line.marginTop != null && line.marginTop !== 0 ? { marginTop: line.marginTop } : {}),
                  ...(line.marginBottom != null && line.marginBottom !== 2 ? { marginBottom: line.marginBottom } : {}),
                  ...(lineFont ? { font: lineFont } : {}),
                  ...(line.bold ? { bold: line.bold } : {}),
                  ...(line.scaleX ? { scaleX: line.scaleX } : {}),
                  ...(line.scaleY ? { scaleY: line.scaleY } : {}),
                  ...(line.spacing ? { spacing: line.spacing } : {}),
                  ...(line.rules && line.rules.length > 0 ? { rules: line.rules } : {}),
                };
              }
              const rawText = substituteVars(line.text, subVars);
              const eff = line.effect || 'SCROLL';
              return {
                subpages: [{
                  text: rawText,
                  color: line.color || defaultColor,
                  ...(line.bgColor ? { bgColor: line.bgColor } : {}),
                  effect: eff === 'paginate' ? 'STATIC' : eff,
                  ...(line.align && line.align !== 'center' ? { align: line.align } : {}),
                  ...(line.scrollSpeed != null && line.scrollSpeed !== 1 ? { scrollSpeed: line.scrollSpeed } : {}),
                  ...(lineFont ? { font: lineFont } : {}),
                  durationMs: pageDuration * 1000,
                }],
                ...(line.marginTop != null && line.marginTop !== 0 ? { marginTop: line.marginTop } : {}),
                ...(line.marginBottom != null && line.marginBottom !== 2 ? { marginBottom: line.marginBottom } : {}),
                ...(lineFont ? { font: lineFont } : {}),
                ...(line.scaleX ? { scaleX: line.scaleX } : {}),
                ...(line.scaleY ? { scaleY: line.scaleY } : {}),
                ...(line.spacing ? { spacing: line.spacing } : {}),
                ...(line.rules && line.rules.length > 0 ? { rules: line.rules } : {}),
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
      const endEpoch = startEpoch + c.durationMinutes * 60;
      
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
        const uDur = (u as any).durationMinutes || 30;
        let startEpoch = nextStartEpoch;

        const uStartStr = (u as any).startTime;
        const uStart = uStartStr ? Math.floor(new Date(uStartStr).getTime() / 1000) : 0;
        
        if (uStart > nextStartEpoch) {
          blocks.push({
            startEpoch: nextStartEpoch,
            endEpoch: uStart,
            pages: buildPages(null, 'OPEN', sequence.idle)
          });
          startEpoch = uStart;
        } else if (uStart > 0 && uStart < nextStartEpoch) {
          // If it overlaps, clamp it
          startEpoch = nextStartEpoch;
        }
        
        const endEpoch = startEpoch + uDur * 60;
        
        blocks.push({
          startEpoch,
          endEpoch,
          pages: buildPages(u, 'PLAYING', sequence.game)
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
