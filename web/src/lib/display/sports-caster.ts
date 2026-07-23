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
    zones?: {
      panelStart: number;
      panelEnd: number;
      borderRows?: { start: number; end: number }[];
      scale?: number;
      valign?: string;
      lines: { text: string; color: string; effect: string; align?: string; scrollSpeed?: number; marginTop?: number; marginBottom?: number }[];
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
    if (!first) w += SPACING * scale;
    w += text[i] === ' ' ? 0 : CHAR_W * scale;
    first = false;
  }
  return w;
}

function paginateWords(text: string, maxW: number, scale: number): string[] {
  const chunks: string[] = [];
  const words = text.split(' ');
  let cur: string[] = [];
  let curW = 0;
  for (const word of words) {
    if (word.length === 0) continue;
    const wordW = textWidthPx(word, scale);
    if (cur.length === 0) {
      cur.push(word);
      curW = wordW;
    } else {
      const gapW = SPACING * scale;
      if (curW + gapW + wordW > maxW) {
        chunks.push(cur.join(' '));
        cur = [word];
        curW = wordW;
      } else {
        cur.push(word);
        curW += gapW + wordW;
      }
    }
  }
  if (cur.length > 0) chunks.push(cur.join(' '));
  return chunks.length > 0 ? chunks : [text];
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
      if (tpl.zones) {
        let maxChunks = 1;
        const mappedZones = tpl.zones.map(zone => {
          const zoneW = (zone.panelEnd - zone.panelStart + 1) * 32;
          const mappedLines = zone.lines.map(line => {
            const rawText = substituteVars(line.text, subVars);
            const eff = line.effect || 'SCROLL';
            let chunks = [rawText];
            if (eff === 'paginate') {
              const scale = zone.scale ? zone.scale : (zone.lines.length === 2 ? 1 : 2);
              chunks = paginateWords(rawText, zoneW, scale);
              if (chunks.length > maxChunks) maxChunks = chunks.length;
            }
            return {
              textChunks: chunks,
              color: line.color || defaultColor,
              effect: eff,
              ...(line.align && line.align !== 'center' ? { align: line.align } : {}),
              ...(line.scrollSpeed != null && line.scrollSpeed !== 1 ? { scrollSpeed: line.scrollSpeed } : {}),
              ...(line.marginTop != null && line.marginTop !== 0 ? { marginTop: line.marginTop } : {}),
              ...(line.marginBottom != null && line.marginBottom !== 2 ? { marginBottom: line.marginBottom } : {}),
            };
          });
          return {
            panelStart: zone.panelStart,
            panelEnd: zone.panelEnd,
            ...(zone.borderRows && zone.borderRows.length > 0 ? { borderRows: zone.borderRows } : {}),
            ...(zone.scale ? { scale: zone.scale } : {}),
            ...(zone.valign && zone.valign !== 'middle' ? { valign: zone.valign } : {}),
            lines: mappedLines
          };
        });

        for (let i = 0; i < maxChunks; i++) {
          pages.push({
            zones: mappedZones.map(z => ({
              panelStart: z.panelStart,
              panelEnd: z.panelEnd,
              ...(z.borderRows ? { borderRows: z.borderRows } : {}),
              ...(z.scale ? { scale: z.scale } : {}),
              ...(z.valign ? { valign: z.valign } : {}),
              lines: z.lines.map(l => ({
                text: l.textChunks[i % l.textChunks.length],
                color: l.color,
                effect: l.effect === 'paginate' ? 'STATIC' : l.effect,
                ...(l.align ? { align: l.align } : {}),
                ...(l.scrollSpeed != null ? { scrollSpeed: l.scrollSpeed } : {}),
                ...(l.marginTop != null ? { marginTop: l.marginTop } : {}),
                ...(l.marginBottom != null ? { marginBottom: l.marginBottom } : {}),
              }))
            })),
            durationSeconds: maxChunks > 1 ? 1.5 : (tpl.durationSeconds ?? section.interval),
          });
        }
      } else {
        const raw = tpl.text ?? tpl.line1 ?? '';
        const text = substituteVars(raw, subVars);
        const eff = (tpl.effect ?? 'SCROLL');
        if (eff === 'paginate') {
          const chunks = paginateWords(text, 64, 2); // default panel width guess for simple pages
          for (let i = 0; i < chunks.length; i++) {
            pages.push({
              text: chunks[i],
              color: tpl.color ?? defaultColor,
              effect: 'STATIC',
              durationSeconds: 1.5,
            });
          }
        } else {
          pages.push({
            text,
            color: tpl.color ?? defaultColor,
            effect: eff as any,
            durationSeconds: tpl.durationSeconds ?? section.interval,
          });
        }
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
    display: {
      pages
    }
  };
}
