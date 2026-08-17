import { NextResponse } from 'next/server';
import { processAllCourts } from '@/lib/queue/queue-processor';
import { publishAllDisplays } from '@/lib/display/publish-all';

// Vercel cron: reconcile the ledger + republish every minute. The LED displays
// are schedule-driven and advance locally (real-time), so this only closes
// finished games, promotes waiters, and refreshes displays/board when the venue
// is otherwise idle (no join/leave/admin event firing).
export const schedule = { cron: '* * * * *' };

async function advance() {
  const started = Date.now();
  await processAllCourts();
  const res = await publishAllDisplays();
  return NextResponse.json({
    ok: res.ok,
    total: res.total,
    failed: res.failed,
    elapsedMs: Date.now() - started,
  });
}

export async function GET() {
  return advance();
}

export async function POST() {
  return advance();
}
