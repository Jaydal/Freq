import { useState, useEffect } from 'react';


export interface CourtStatusData {
  id: string;
  name: string;
  status: string;
  matchType?: string;
  matchTitle?: string;
  elapsed?: number;
  duration?: number;
  prepTimeSec?: number;
  players?: Array<{ first_name: string; last_name: string }>;
  start_time?: string;
}

interface Props {
  court: CourtStatusData;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// A court is active purely from its schedule: a game whose window
// (start_time + duration) has not yet ended.
export function isActiveNow(court: CourtStatusData, nowMs = Date.now()): boolean {
  if (!court.start_time) return false;
  const end = new Date(court.start_time).getTime() + (court.duration ?? 0) * 60_000;
  return nowMs < end;
}

export function CourtStatusCard({ court }: Props) {
  const [now, setNow] = useState(Date.now());

  const isActive = isActiveNow(court, now);

  useEffect(() => {
    if (!isActive || !court.start_time) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive, court.start_time]);

  const elapsed = court.start_time ? Math.floor((now - new Date(court.start_time).getTime()) / 1000) : 0;
  const totalSec = court.duration ? court.duration * 60 : 0;
  const remain = isActive ? Math.max(0, totalSec - elapsed) : 0;

  return (
    <div className={`rounded-lg p-3 border-l-4 ${
      isActive
        ? 'bg-zinc-900 border-l-emerald-400'
        : 'bg-zinc-800/50 border-l-zinc-600'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-100">{court.name}</h3>
        {isActive && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
            {'In Game'}
          </span>
        )}
        {!isActive && court.status !== 'Scheduled' && (
          <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
            Available
          </span>
        )}
      </div>

      {court.matchTitle && (
        <div className="text-xs text-zinc-400 mb-1.5">{court.matchTitle}</div>
      )}

      {isActive && court.duration && (
        <>
          <div className="flex flex-col items-center py-2">
            <div className="rounded-xl px-4 py-3 bg-emerald-500/10">
              <span className="text-5xl font-mono font-black tracking-wider tabular-nums text-emerald-400">
                {formatTime(remain)}
                <span className="text-2xl font-medium opacity-40 ml-1">LEFT</span>
              </span>
            </div>
            <div className="flex gap-3 mt-2 text-[11px] text-zinc-500 tabular-nums">
              <span>Elapsed {formatTime(elapsed)}</span>
            </div>
          </div>
          {court.players && court.players.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {court.players.slice(0, 2).map((p, i) => (
                <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                  {p.first_name} {p.last_name}
                </span>
              ))}
              {court.players.length > 2 && (
                <span className="text-xs text-zinc-500">+{court.players.length - 2}</span>
              )}
            </div>
          )}
        </>
      )}

      {isActive && court.matchType && (
        <div className="text-xs text-zinc-500 mt-1">{court.matchType}</div>
      )}
    </div>
  );
}
