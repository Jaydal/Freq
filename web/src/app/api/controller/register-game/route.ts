import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishDisplay } from '@/lib/mqtt';
import { generatePayload } from '@/lib/display/sports-caster';
import { getBoardSnapshot } from '@/lib/queue/board-snapshot';
import { publishBoardOnce } from '@/lib/queue/board-publisher';
import { z } from 'zod';

const schema = z.object({
  courtName: z.string(),
  matchType: z.string(),
  duration:  z.number(),
  players:   z.array(z.object({
    rfid:         z.string(),
    team:         z.string().optional(),
    chargeAmount: z.number(),
  })),
});

// Hardware controllers authenticate with a static API key in x-api-key header.
// Set CONTROLLER_API_KEY in .env.local. If unset, the endpoint is open (dev only).
function checkControllerKey(request: Request): boolean {
  const apiKey = process.env.CONTROLLER_API_KEY;
  if (!apiKey) return false;
  return request.headers.get('x-api-key') === apiKey;
}

export async function POST(request: Request) {
  if (!checkControllerKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { courtName, matchType, duration, players } = result.data;
  const supabase = await createClient();

  // Fix #1 & #2: single atomic DB transaction — all wallet debits + game creation
  // happen inside one SQL function, so no partial state on crash.
  const { data: gameId, error } = await supabase.rpc('register_game', {
    p_court_name: courtName,
    p_match_type: matchType,
    p_duration:   duration,
    p_players:    players.map(p => ({
      rfid:          p.rfid,
      team:          p.team ?? null,
      charge_amount: p.chargeAmount,
    })),
  });

  if (error) {
    // Fix #16: never echo RFID UIDs or raw DB messages to the caller
    const msg =
      error.message.includes('Court not found')  ? 'Court not found'     :
      error.message.includes('Invalid RFID')     ? 'Invalid card'         :
      error.message.includes('Wallet not found') ? 'Wallet not found'     :
      error.message.includes('Insufficient')     ? 'Insufficient funds'   :
                                                   'Registration failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data: court } = await supabase
    .from('courts').select('id, name').eq('name', courtName).single();

  if (court) {
    try {
      const snapshot = await getBoardSnapshot(supabase);
      const c = snapshot.courts.find(ct => ct.id === court.id);
      if (c) {
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

        const { data: settings } = await supabase.from('settings').select('value').eq('key', 'displaySequence').single();
        let displaySequence;
        try { if (settings?.value) displaySequence = JSON.parse(settings.value); } catch {}

        const payload = generatePayload(c.id, { current, upcoming }, {
          courtName: c.name,
          queueCount: courtQueueCount,
          displaySequence,
        });
        
        publishDisplay(c.id, payload).catch(() => {});
      }
      publishBoardOnce().catch(() => {});
    } catch (e) {
      console.error('Failed to publish display after register', e);
    }
  }

  return NextResponse.json({ success: true, gameId });
}
