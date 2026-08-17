'use client';

import { useState, useEffect, useCallback } from 'react';
import { CourtStatusCard, type CourtStatusData } from './CourtStatusCard';
import { NowServingCard } from './NowServingCard';
import { QueueList, type QueueEntryDisplay } from './QueueList';
import { fetchBoardSnapshot } from '@/app/terminal/queue/actions';
import type { BoardSnapshot } from '@/lib/queue/board-snapshot';

export function QueueBoard() {
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInitial = useCallback(async () => {
    try {
      const data = await fetchBoardSnapshot();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch board snapshot', err);
      setError('Unable to load court data. Retrying...');
    }
  }, []);

  useEffect(() => {
    fetchInitial();

    const es = new EventSource('/api/queue/events');
    let sseDebounce: ReturnType<typeof setTimeout> | null = null;
    es.onmessage = () => {
      if (sseDebounce) clearTimeout(sseDebounce);
      sseDebounce = setTimeout(() => {
        sseDebounce = null;
        fetchInitial();
      }, 100);
    };
    es.onerror = (err) => console.error('SSE Error:', err);

    return () => {
      es.close();
      if (sseDebounce) clearTimeout(sseDebounce);
    };
  }, [fetchInitial]);

  if (!snapshot) {
    if (error) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <button onClick={fetchInitial} className="text-sky-400 underline text-sm">Retry now</button>
          </div>
        </div>
      );
    }
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  const { courts, nowServing, queue } = snapshot;

  const nowSec = snapshot.serverTime || Math.floor(Date.now() / 1000);
  const courtDisplays: CourtStatusData[] = courts.map((c) => {
    const isPlayingNow = c.startTime > 0 && c.startTime <= nowSec;
    return {
      id: c.id,
      name: c.name,
      status: isPlayingNow ? 'In Progress' : 'Available',
      matchType: c.matchType,
      matchTitle: c.matchTitle,
      duration: c.durationMin,
      elapsed: isPlayingNow ? nowSec - c.startTime : 0,
      
      start_time: isPlayingNow ? new Date(c.startTime * 1000).toISOString() : undefined,
      players: c.players.map((p) => ({ first_name: p.firstName, last_name: p.lastName })),
    };
  });

  const queueDisplay: QueueEntryDisplay[] = queue.map((q) => ({
    id: q.id,
    position: q.position,
    firstName: q.firstName,
    lastName: q.lastName,
    matchType: q.matchType,
    matchTitle: q.matchTitle,
    courtName: q.courtName,
    duration: q.durationMin,
    estimatedWait: q.estimatedWait,
    estimatedStartTime: q.estimatedStartTime * 1000,
    bookedAt: q.bookedAt * 1000,
  }));

  return (
    <div className="min-h-screen bg-black p-3">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <h1 className="text-base font-medium text-zinc-500">Courts</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-3 space-y-2">
            {courtDisplays.map((c) => (
              <CourtStatusCard key={c.id} court={c} />
            ))}
          </div>

          <div className="lg:col-span-2 space-y-3">
            <NowServingCard
              playerNames={nowServing.playerFirstName || 'Player'}
              courtName={nowServing.courtName}
              duration={nowServing.durationMin}
              expiresAt={nowServing.hasOffer ? new Date(nowServing.expiresAt * 1000).toISOString() : null}
            />

            <div className="bg-zinc-900 rounded-lg p-3">
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Queue ({queue.length})
              </h2>
              <QueueList entries={queueDisplay} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
