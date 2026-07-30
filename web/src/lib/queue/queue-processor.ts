import { createClient } from '@/lib/supabase/server';
import { isSlotAvailable } from './booking-engine';
import { getCost, ProductsConfig } from '@/lib/products-config-types';
import { publishDisplay } from '@/lib/mqtt';
import { generatePayload } from '@/lib/display/sports-caster';

export async function processCourtQueue(courtId: string): Promise<void> {
  const supabase = await createClient();

  // Verify this court is actually free right now
  const now = new Date();
  const { data: court } = await supabase.from('courts').select('id, name').eq('id', courtId).single();
  if (!court) return;

  const { data: activeGames } = await supabase
    .from('games')
    .select('id, duration, start_time, status')
    .eq('court_id', courtId)
    .in('status', ['In Progress', 'Scheduled']);

  if (activeGames && activeGames.length > 0) {
    for (const game of activeGames) {
      if (!game.start_time) continue;
      const gameEnd = new Date(new Date(game.start_time).getTime() + game.duration * 60_000);
      if (gameEnd > now) return; // Court is still occupied by this game
    }
  }

  // If we get here, there are no active games blocking the court.

  // Get the oldest waiting entries ordered by created_at
  const { data: waiting } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('status', 'waiting')
    .order('created_at', { ascending: true });

  if (!waiting || waiting.length === 0) return;

  // Try to match the first compatible waiting entry to this court
  for (const entry of waiting) {
    // If entry has a specific court preference, it must match this court
    if (entry.court_id && entry.court_id !== courtId) continue;

    // Check if the slot is still available for this duration
    const end = new Date(now.getTime() + entry.duration * 60_000);
    const slotFree = await isSlotAvailable(courtId, now, end, entry.id);
    if (!slotFree) continue;

    // Calculate charge
    const { data: pricesRow } = await supabase.from('settings').select('value').eq('key', 'prices').single();
    const rates: Record<string, number> = pricesRow?.value ? JSON.parse(pricesRow.value) : { '30': 150, '60': 300, '90': 450 };
    const config: ProductsConfig = { matchTypes: [], durations: [], rates };
    const getCost = (d: number, s: number) => {
      return Math.round((rates[String(d)] ?? 0) * (d / 30) / (s === 4 ? 2 : 1));
    };
    const charge = getCost(entry.duration, entry.party_size);
    if (charge === 0) continue;

    // Check member is still active and has sufficient balance
    const { data: member } = await supabase.from('members').select('status').eq('id', entry.member_id).single();
    if (!member || member.status !== 'Active') continue;

    // Wallet was already verified and deducted when joining the queue.

    // Create the game
    const matchType = entry.party_size === 4 ? '2v2' : '1v1';
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .insert({
        court_id: courtId,
        match_type: matchType,
        match_title: entry.match_title ?? null,
        duration: entry.duration,
        status: 'In Progress',
        start_time: now.toISOString(),
        charge_amount: charge,
      })
      .select()
      .single();

    if (gameErr || !game) continue;

    // Insert game_players
    const playerIds: string[] = typeof entry.player_ids === 'string'
      ? JSON.parse(entry.player_ids)
      : entry.player_ids;

    const { error: gpErr } = await supabase
      .from('game_players')
      .insert(playerIds.map(pid => ({ game_id: game.id, member_id: pid, team: null })));
    if (gpErr) {
      await supabase.from('games').update({ status: 'Cancelled' }).eq('id', game.id);
      continue;
    }

    // Wallet was already deducted when they joined the queue.

    // Update queue entry to completed
    await supabase.from('queue_entries').update({ status: 'completed', court_id: courtId, updated_at: now.toISOString() }).eq('id', entry.id);

    // Publish display and board
    const { data: seqSettings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['displaySequence', 'preparationTime']);

    let displaySequence;
    try {
      const v = seqSettings?.find(s => s.key === 'displaySequence')?.value;
      if (v) displaySequence = JSON.parse(v);
    } catch {}

    const rawPrepSec = parseInt(seqSettings?.find(s => s.key === 'preparationTime')?.value ?? '300', 10);
    const prepTimeSec = isNaN(rawPrepSec) ? 300 : rawPrepSec;

    const { data: allWaiting } = await supabase
      .from('queue_entries')
      .select('court_id')
      .eq('status', 'waiting');

    const courtQueueCount = allWaiting?.length ?? 0;

    publishDisplay(courtId, generatePayload(courtId, {
      current: {
        name: entry.match_title || '',
        startTime: now.toISOString(),
        durationMinutes: entry.duration,
        matchTitle: entry.match_title || '',
        matchType,
      },
      upcoming: [],
    }, {
      courtName: court.name,
      queueCount: courtQueueCount,
      displaySequence,
      
    }));

    return;
  }
}

export async function processAllCourts(): Promise<void> {
  const supabase = await createClient();
  const { data: courts } = await supabase.from('courts').select('id');
  if (!courts) return;
  for (const c of courts) {
    await processCourtQueue(c.id);
  }
}
