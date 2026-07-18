import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishDisplay } from '@/lib/mqtt';
import { generatePayload, DisplaySequenceConfig } from '@/lib/display/sports-caster';
import { publishBoardOnce } from '@/lib/queue/board-publisher';
import { processAllCourts } from '@/lib/queue/queue-processor';

export async function GET() {
  return handlePublishAll();
}

export async function POST() {
  return handlePublishAll();
}

async function handlePublishAll() {
  const supabase = await createClient();

  const [{ data: courts }, { data: games }, { data: settingsRows }, { data: queue }] = await Promise.all([
    supabase.from('courts').select('*').order('name'),
    supabase.from('games').select('*, courts!inner(name)').in('status', ['In Progress', 'Scheduled']).order('start_time', { ascending: false }),
    supabase.from('settings').select('key, value').in('key', ['displaySequence', 'preparationTime']),
    supabase.from('queue_entries').select('*, members(first_name)').eq('status', 'waiting').order('created_at', { ascending: true }),
  ]);

  const settings = new Map<string, string>((settingsRows ?? []).map((r: any) => [r.key, r.value]));
  const prepTimeSec = parseInt(settings.get('preparationTime') ?? '', 10) || 300;
  let displaySequence: DisplaySequenceConfig | undefined;
  try { const v = settings.get('displaySequence'); if (v) displaySequence = JSON.parse(v); } catch {}

  const gameByCourt = new Map<string, any>();
  (games ?? []).forEach((g: any) => gameByCourt.set(g.court_id, g));

  const queueCount = (queue ?? []).length;
  const firstWaiting = (queue ?? [])[0];
  const nextName = firstWaiting?.members?.first_name ?? '';
  const nextMatch = firstWaiting?.match_title ?? (firstWaiting ? `${firstWaiting.party_size === 4 ? '2v2' : '1v1'}` : '');

  for (const court of courts ?? []) {
    const game = gameByCourt.get(court.id);

    let current = null;
    if (game) {
      current = {
        name: game.match_title || game.match_type || 'MATCH',
        startTime: game.start_time || new Date().toISOString(),
        durationMinutes: game.duration,
        matchTitle: game.match_title || '',
        matchType: game.match_type || '',
      };
    }

    const upcoming = (queue ?? []).map(q => ({
       name: q.match_title || `Waiting Team`
    }));

    const payload = generatePayload(court.id, { current, upcoming }, {
      courtName: court.name,
      queueCount,
      displaySequence,
      prepTimeSec,
      nextName,
      nextMatch,
    });
    await publishDisplay(court.id, payload);
  }

  await processAllCourts();
  await publishBoardOnce();

  return NextResponse.json({ ok: true, courts: courts?.length ?? 0 });
}
