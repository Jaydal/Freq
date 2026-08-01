import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureConnected, getDisplayState, getCourtStatus, isBrokerConnected } from '@/lib/mqtt';
import { generatePayload } from '@/lib/display/sports-caster';


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courtId: string }> },
) {
  const { courtId } = await params;
  await ensureConnected();

  let display = getDisplayState(courtId);
  let gameInfo: { startTime: string; duration: number; } | null = null;

  const supabase = await createClient();
  
  // Fetch display sequence once for both branches
  const { data: s } = await supabase.from('settings').select('value').eq('key', 'displaySequence').single();
  let displaySequence;
  try { if (s?.value) displaySequence = JSON.parse(s.value); } catch {}

  if (!display) {
    const { data: game } = await supabase
      .from('games')
      .select('id, match_type, match_title, status, duration, start_time, courts!inner(name)')
      .eq('court_id', courtId)
      .eq('status', 'In Progress')
      .order('start_time', { ascending: false })
      .limit(1)
      .single();

    if (game) {
      display = generatePayload(courtId, {
        current: { name: game.match_title ?? '', startTime: game.start_time, durationMinutes: game.duration },
        upcoming: []
      }, { displaySequence });
      gameInfo = { startTime: game.start_time, duration: game.duration };
    }
  }

  if (!display) {
    const { data: court } = await supabase
      .from('courts')
      .select('name')
      .eq('id', courtId)
      .single();

    display = generatePayload(courtId, { current: null, upcoming: [] }, { courtName: court?.name, displaySequence });
  }

  const status = getCourtStatus(courtId);

  return NextResponse.json({
    courtId,
    display,
    status: status ?? null,
    game: gameInfo,
  });
}
