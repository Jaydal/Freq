import { createClient } from '@/lib/supabase/server';
import { isSlotAvailable } from './booking-engine';
import { getCost, ProductsConfig, effectivePrepSec } from '@/lib/products-config-types';
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
    .in('status', ['In Progress', 'Scheduled'])
    .gte('start_time', now.toISOString());

  if (activeGames && activeGames.length > 0) {
    for (const game of activeGames) {
      const { data: settings } = await supabase.from('settings').select('value').eq('key', 'preparationTime').single();
      const rawPrepSec = parseInt(settings?.value ?? '300', 10);
      const prepSec = isNaN(rawPrepSec) ? 300 : rawPrepSec;
      const effectivePrep = effectivePrepSec(game.duration, prepSec);
      const gameEnd = new Date(new Date(game.start_time).getTime() + effectivePrep * 1000 + game.duration * 60_000);
      if (gameEnd > now) return;
    }
  }

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
    const config: ProductsConfig = { matchTypes: [], durations: [], rates, prepTimeSec: 0 };
    const charge = getCost(config, entry.duration, entry.party_size);
    if (charge === 0) continue;

    // Check member is still active and has sufficient balance
    const { data: member } = await supabase.from('members').select('status').eq('id', entry.member_id).single();
    if (!member || member.status !== 'Active') continue;

    const { data: wallet } = await supabase.from('wallets').select('id, balance').eq('member_id', entry.member_id).single();
    if (!wallet || wallet.balance < charge) continue;

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

    // Update court status
    await supabase.from('courts').update({ status: 'In Game', last_activity: now.toISOString() }).eq('id', courtId);

    // Deduct wallet
    const { data: updated } = await supabase
      .from('wallets')
      .update({ balance: wallet.balance - charge })
      .eq('id', wallet.id)
      .eq('balance', wallet.balance)
      .select()
      .single();

    if (!updated) {
      await supabase.from('games').update({ status: 'Cancelled' }).eq('id', game.id);
      await supabase.from('courts').update({ status: 'Available' }).eq('id', courtId);
      continue;
    }

    await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      amount: -charge,
      type: 'game_fee',
      reference_number: game.id,
    });

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
      prepTimeSec,
    }));

    return;
  }
}

export async function completeExpiredGames(): Promise<string[]> {
  const supabase = await createClient();
  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'preparationTime').single();
  const rawPrepSec = parseInt(settings?.value ?? '300', 10);
  const prepSec = isNaN(rawPrepSec) ? 300 : rawPrepSec;
  const now = new Date();

  const { data: activeGames } = await supabase
    .from('games')
    .select('id, court_id, duration, start_time')
    .in('status', ['In Progress', 'Scheduled']);

  const freedCourtIds = new Set<string>();

  for (const game of activeGames ?? []) {
    if (!game.start_time) continue;
    const effectivePrep = effectivePrepSec(game.duration, prepSec);
    const gameEnd = new Date(new Date(game.start_time).getTime() + effectivePrep * 1000 + game.duration * 60_000);
    if (now >= gameEnd) {
      await supabase
        .from('games')
        .update({ status: 'Completed', end_time: now.toISOString() })
        .eq('id', game.id);
      freedCourtIds.add(game.court_id);
    }
  }

  if (freedCourtIds.size > 0) {
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['displaySequence', 'preparationTime']);

    let displaySequence;
    try {
      const v = settings?.find(s => s.key === 'displaySequence')?.value;
      if (v) displaySequence = JSON.parse(v);
    } catch {}

    const { data: courts } = await supabase
      .from('courts')
      .select('id, name')
      .in('id', [...freedCourtIds]);

    const { data: waiting } = await supabase
      .from('queue_entries')
      .select('court_id')
      .eq('status', 'waiting');

    const courtQueueCounts = new Map<string, number>();
    if (waiting) {
      for (const e of waiting) {
        courtQueueCounts.set(e.court_id, (courtQueueCounts.get(e.court_id) ?? 0) + 1);
      }
    }

    for (const court of courts ?? []) {
      const payload = generatePayload(court.id, { current: null, upcoming: [] }, {
        courtName: court.name,
        queueCount: courtQueueCounts.get(court.id) ?? 0,
        displaySequence,
      });
      publishDisplay(court.id, payload);
    }
  }

  return [...freedCourtIds];
}

export async function processAllCourts(): Promise<void> {
  const freedCourts = await completeExpiredGames();
  const supabase = await createClient();
  const { data: courts } = await supabase.from('courts').select('id');
  if (!courts) return;
  const courtIds = new Set([...courts.map(c => c.id), ...freedCourts]);
  for (const id of courtIds) {
    await processCourtQueue(id);
  }
}
