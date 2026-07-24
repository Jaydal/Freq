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
  upcoming: { name: string }[];
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
    zones?: {
      panelStart: number;
      panelEnd: number;
      borderRows?: { start: number; end: number }[];
      scale?: number;
      valign?: string;
      lines: { text: string; color: string; effect: string; align?: string; scrollSpeed?: number; marginTop?: number; marginBottom?: number; subpages?: { text: string; color: string; effect: string; align?: string; scrollSpeed?: number; durationMs: number }[] }[];
    }[];
  }[];
}

export interface DisplaySequenceConfig {
  idle: DisplaySequenceSection;
  prep: DisplaySequenceSection;
  game: DisplaySequenceSection;
}

const DEFAULT_SEQUENCE: DisplaySequenceConfig = {
  idle: { interval: 10, pages: [{ text: "{court_name}" }, { text: "{queue_count} IN QUEUE" }] },
  prep: { interval: 10, pages: [{ text: "{match_title}" }, { text: "{timer}" }] },
  game: { interval: 10, pages: [{ text: "{match_title}" }, { text: "{timer} LEFT" }, { text: "{queue_count} IN QUEUE" }] },
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

  const pages: DisplayPage[] = [];
  let state: 'OPEN' | 'PLAYING' | 'MAINTENANCE' = 'OPEN';

  let section: DisplaySequenceSection | null = null;
  if (schedule.maintenance) {
    state = 'MAINTENANCE';
    section = null;
    pages.push({
      text: `${courtName} CLOSED FOR MAINTENANCE`,
      color: "#FF0000",
      effect: "SCROLL",
      durationSeconds: 10
    });
  } else if (!schedule.current) {
    state = 'OPEN';
    section = sequence.idle;
  } else {
    state = 'PLAYING';
    section = sequence.game;
  }

  const c = schedule.current;
  const subVars: Record<string, string> = {
    court_name: courtName,
    match_info: c?.name ?? '',
    match_title: c?.matchTitle || c?.name || 'IN GAME',
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
        const allEmpty = tpl.hideIfEmpty.every(k => {
          const v = subVars[k];
          return v === undefined || v === '';
        });
        if (allEmpty) continue;
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

        pages.push({
          zones: mappedZones,
          durationSeconds: pageDuration,
        });
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
    state,
    schedule: mappedSchedule,
    serverTime,
    ...(opts?.brightness != null ? { brightness: opts.brightness } : {}),
    ...(opts?.rotation != null ? { rotation: opts.rotation } : {}),
    display: {
      pages
    }
  };
}
