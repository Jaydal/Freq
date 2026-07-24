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
    supabase.from('games').select('*, game_players(member_id, members(first_name)), courts!inner(name)').in('status', ['In Progress', 'Scheduled']).order('start_time', { ascending: false }),
    supabase.from('settings').select('key, value').in('key', ['displaySequence', 'preparationTime']),
    supabase.from('queue_entries').select('*, members(first_name)').eq('status', 'waiting').order('created_at', { ascending: true }),
  ]);

  const settings = new Map<string, string>((settingsRows ?? []).map((r: any) => [r.key, r.value]));
  const prepTimeSec = parseInt(settings.get('preparationTime') ?? '', 10) || 300;
  let displaySequence: DisplaySequenceConfig | undefined;
  let brightness = 153;
  try {
    const v = settings.get('displaySequence');
    if (v) {
      const parsed = JSON.parse(v);
      displaySequence = parsed;
      brightness = parsed.brightness ?? 153;
    }
  } catch {}

  const gameByCourt = new Map<string, any>();
  (games ?? []).forEach((g: any) => gameByCourt.set(g.court_id, g));

  const firstWaiting = (queue ?? [])[0];

  for (const court of courts ?? []) {
    const game = gameByCourt.get(court.id);

    // Count waiting entries: either unassigned or specifically for this court
    const courtQueueCount = (queue ?? []).filter(
      (q: any) => q.court_id === null || q.court_id === court.id
    ).length;

    let current = null;
    if (game) {
      // Build display name: match_title → "Player - 2v2"
      let name = game.match_title || '';
      if (!name && game.game_players?.length) {
        const playerNames = game.game_players
          .map((p: any) => p.members?.first_name || '')
          .filter(Boolean)
          .join(' & ');
        name = `${playerNames} - ${game.match_type || ''}`;
      }
      if (!name) name = game.match_type || '';

      current = {
        name,
        startTime: game.start_time || new Date().toISOString(),
        durationMinutes: game.duration,
        matchTitle: game.match_title || '',
        matchType: game.match_type || '',
      };
    }

    const upcoming = (queue ?? []).map((q: any) => ({
      name: q.match_title || ''
    }));

    // Find next scheduled game's start time
    const nextGame = (games ?? []).filter((g: any) => g.status === 'Scheduled' && g.court_id === court.id).sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
    const nextBookedTime = nextGame ? (() => {
      const d = new Date(nextGame.start_time);
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${m.toString().padStart(2, '0')}${ampm}`;
    })() : '';

    const payload = generatePayload(court.id, { current, upcoming }, {
      courtName: court.name,
      queueCount: courtQueueCount,
      displaySequence,
      prepTimeSec,
      brightness,
      nextName: firstWaiting?.members?.first_name ?? '',
      nextMatch: firstWaiting?.match_title ?? '',
      nextWait: firstWaiting?.created_at ? (() => {
        const ms = Date.now() - new Date(firstWaiting.created_at).getTime();
        const min = Math.floor(ms / 60000);
        return min < 1 ? '<1min' : `${min}min`;
      })() : '',
      nextBookedTime,
    });
    await publishDisplay(court.id, payload);
  }

  await processAllCourts();
  await publishBoardOnce();

  return NextResponse.json({ ok: true, courts: courts?.length ?? 0 });
}
