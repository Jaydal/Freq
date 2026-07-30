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

      const upcoming = snapshot.queue
        .filter(q => !q.courtName || q.courtName === c.name)
        .map(q => ({
          name: q.matchTitle,
          durationMinutes: q.durationMin,
          }));

      const payload = generatePayload(c.id, { current, upcoming }, {
        courtName: c.name,
        queueCount: courtQueueCount,
        displaySequence,
        
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
