'use client';

import { useState, useEffect, useCallback } from 'react';
import { isActiveNow } from './CourtStatusCard';
import { fetchBoardSnapshot } from '@/app/terminal/queue/actions';

interface CourtState {
  id: string;
  name: string;
  status: string;
  elapsed: number;
  duration?: number;
  start_time?: string;
  }

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CourtOverviewItem({ court }: { court: CourtState }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (court.status !== 'In Progress' || !court.start_time) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [court.status, court.start_time]);

  const isActive = court.status === 'In Progress';
  const elapsed = court.start_time ? Math.floor((now - new Date(court.start_time).getTime()) / 1000) : 0;
  const totalSec = court.duration ? court.duration * 60 : 0;
  const remain = isActive ? Math.max(0, totalSec - elapsed) : 0;

  return (
    <div className={`shrink-0 w-[140px] sm:w-auto rounded px-2 py-1.5 border ${isActive ? 'bg-zinc-900 border-emerald-500/20' : 'bg-zinc-900/50 border-zinc-800'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className={`size-1.5 shrink-0 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
          <span className="text-xs font-medium text-zinc-300 truncate">{court.name}</span>
        </div>
        {isActive && (
          <span className="text-xs font-mono text-zinc-400 tabular-nums shrink-0 ml-2">{formatTime(elapsed)}</span>
        )}
      </div>
    </div>
  );
}

export function CourtOverview() {
  const [courts, setCourts] = useState<CourtState[]>([]);
  const fetchAll = useCallback(async () => {
    try {
      const snap = await fetchBoardSnapshot();
      const nowSec = Math.floor(Date.now() / 1000);
      setCourts(snap.courts.map(c => {
        const isPlayingNow = c.startTime > 0 && c.startTime <= nowSec;
        return {
          id: c.id,
          name: c.name,
          status: isPlayingNow ? 'In Progress' : 'Available',
          elapsed: isPlayingNow ? nowSec - c.startTime : 0,
          duration: c.durationMin,
          start_time: isPlayingNow ? new Date(c.startTime * 1000).toISOString() : undefined,
          };
      }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    const es = new EventSource('/api/queue/events');
    let sseDebounce: ReturnType<typeof setTimeout> | null = null;
    es.onmessage = () => { 
      if (sseDebounce) clearTimeout(sseDebounce);
      sseDebounce = setTimeout(() => {
        sseDebounce = null;
        fetchAll();
      }, 100);
    };
    es.onerror = (err) => console.error('SSE Error:', err);

    return () => {
      es.close();
      if (sseDebounce) clearTimeout(sseDebounce);
    };
  }, [fetchAll]);

  return (
    <div className="h-full flex flex-col p-3 gap-1.5 bg-zinc-950">
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:block">Courts</h2>
      <div className="flex sm:flex-col gap-2 sm:gap-1 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto pb-1 sm:pb-0 no-scrollbar">
        {courts.map(c => (
          <CourtOverviewItem key={c.id} court={c} />
        ))}
      </div>
    </div>
  );
}
