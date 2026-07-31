import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishDisplay } from '@/lib/mqtt';
import { generatePayload, DisplaySequenceConfig } from '@/lib/display/sports-caster';
import { publishBoardOnce } from '@/lib/queue/board-publisher';
import { getBoardSnapshot } from '@/lib/queue/board-snapshot';

export async function GET() {
  return handlePublishAll();
}

export async function POST() {
  return handlePublishAll();
}

async function handlePublishAll() {
  try {
    const supabase = await createClient();
    const snapshot = await getBoardSnapshot(supabase);

    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['displaySequence']);
    
    let displaySequence: DisplaySequenceConfig | undefined;
    let brightness = 153;
    let rotation = 0;
    try {
      const v = settingsRows?.find(r => r.key === 'displaySequence')?.value;
      if (v) {
        const parsed = JSON.parse(v);
        displaySequence = parsed;
        brightness = parsed.brightness ?? 153;
        rotation = parsed.rotation ?? 0;
      }
    } catch {}

    for (const c of snapshot.courts) {
      let current = null;
      if (c.startTime > 0) {
        let name = c.matchTitle;
        if (!name && c.players?.length) {
          name = c.players.map(p => p.firstName).join(' & ') + ` - ${c.matchType}`;
        }
        if (!name) name = c.matchType;
        
        current = {
          name,
          startTime: new Date(c.startTime * 1000).toISOString(),
          durationMinutes: c.durationMin,
          matchTitle: c.matchTitle,
          matchType: c.matchType,
        };
      }

      const courtQueueCount = snapshot.queue.filter(q => !q.courtName || q.courtName === c.name).length;

      const upcoming = snapshot.upcomingGames
        .filter(g => g.id === c.id)
        .map(g => ({
          name: g.matchTitle,
          durationMinutes: g.durationMin,
          startTime: new Date(g.startTime * 1000).toISOString(),
        }));

      // Also append waitlist entries that are simulated to run on this court!
      snapshot.queue.filter(q => q.simulatedCourtId === c.id).forEach(q => {
        upcoming.push({
          name: q.matchTitle || (q.firstName + " " + q.lastName + " - " + q.matchType),
          durationMinutes: q.durationMin,
          startTime: new Date(q.estimatedStartTime * 1000).toISOString(),
        });
      });

      // Sort upcoming chronologically
      upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      let nextName = '';
      let nextMatch = '';
      let nextWait = '';
      let nextBookedTime = '';

      if (upcoming.length > 0) {
        const next = upcoming[0];
        // For queue entries we have the full name stored as firstName + lastName in name, but let's just use it
        nextName = next.name;
        nextMatch = next.name; // or matchType if we had it separated
        
        const formatTime = (isoString: string) => 
          new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(isoString));
        
        nextBookedTime = formatTime(next.startTime);
        
        const nowMs = Date.now();
        const startMs = new Date(next.startTime).getTime();
        const waitMins = Math.max(0, Math.floor((startMs - nowMs) / 60000));
        nextWait = waitMins <= 0 ? 'Now' : `~${waitMins} min`;
      }

      const payload = generatePayload(c.id, { current, upcoming }, {
        courtName: c.name,
        queueCount: courtQueueCount,
        displaySequence,
        nextName,
        nextMatch,
        nextWait,
        nextBookedTime,
        brightness,
        rotation,
      });
      
      publishDisplay(c.id, payload);
    }

    publishBoardOnce().catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
