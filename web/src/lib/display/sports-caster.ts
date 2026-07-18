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
  pages: { text?: string; line1?: string; color?: string; effect?: string; durationSeconds?: number }[];
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
    match_title: c?.matchTitle ?? c?.name ?? '',
    match_type: c?.matchType ?? '',
    duration: c ? `${c.durationMinutes}min` : '',
    players: c?.players ?? '',
    queue_count: String(queueCount),
    next_name: opts?.nextName ?? '',
    next_match: opts?.nextMatch ?? '',
  };

  if (section) {
    for (const tpl of section.pages) {
      const raw = tpl.text ?? tpl.line1 ?? '';
      const text = substituteVars(raw, subVars);
      pages.push({
        text,
        color: tpl.color ?? (state === 'PLAYING' ? '#00FFFF' : '#00FF00'),
        effect: (tpl.effect ?? 'SCROLL') as 'SCROLL' | 'STATIC' | 'BLINK',
        durationSeconds: tpl.durationSeconds ?? section.interval,
      });
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
