export interface QueueEntryDisplay {
  id: string;
  position: number;
  firstName: string;
  lastName: string;
  matchType: string;
  matchTitle: string;
  courtName: string;
  duration: number;
  estimatedWait: string;
  estimatedStartTime: number;
  bookedAt: number;
}

interface Props {
  entries: QueueEntryDisplay[];
}

export function QueueList({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-zinc-500 text-xs">No one waiting</p>;
  }

  const formatTime = (ms: number) => 
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(ms));

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-zinc-600 uppercase tracking-wider">
        <span className="size-6 shrink-0" />
        <span className="w-16 shrink-0">Player</span>
        <span className="w-20 shrink-0">Match</span>
        <span className="w-12 shrink-0">Court</span>
        <span className="w-14 shrink-0 text-right">Booked At</span>
        <span className="w-12 shrink-0 text-right">Time</span>
        <span className="w-24 text-right shrink-0">Schedule</span>
        <span className="w-12 text-right shrink-0">Wait</span>
      </div>
      <div className="space-y-1">
        {entries.map((e) => {
          const start = e.estimatedStartTime;
          const end = start + e.duration * 60_000;
          return (
            <div
              key={e.id}
              className="flex items-center gap-2 bg-zinc-800 rounded px-3 py-2"
            >
              <span className={`size-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${
                e.position === 1 ? 'bg-secondary/20 text-secondary' : 'bg-zinc-700 text-zinc-400'
              }`}>
                {e.position}
              </span>
              <span className="text-[11px] text-zinc-100 w-16 truncate shrink-0">
                {e.firstName} {e.lastName}
              </span>
              <span className="text-[10px] shrink-0 px-1 py-0.5 rounded bg-zinc-700 text-zinc-300 font-medium mr-1">{e.matchType}</span>
              {e.matchTitle && <span className="text-[10px] text-zinc-400 truncate max-w-[60px]">{e.matchTitle}</span>}
              <span className="text-[11px] text-zinc-500 w-12 shrink-0">{e.courtName || 'Any'}</span>
              <span className="text-[11px] text-zinc-500 w-14 shrink-0 text-right">{formatTime(e.bookedAt)}</span>
              <span className="text-[11px] text-zinc-500 w-12 shrink-0 text-right">{e.duration}m</span>
              <span className="text-[11px] text-secondary/80 w-24 text-right shrink-0 font-mono tracking-tight">
                {formatTime(start)} - {formatTime(end)}
              </span>
              <span className="text-[11px] text-zinc-400 w-12 text-right shrink-0">{e.estimatedWait}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
