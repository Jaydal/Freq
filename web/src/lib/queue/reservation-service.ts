import { createClient } from '@/lib/supabase/server';
import { isSlotAvailable } from './booking-engine';
import { publishDisplay } from '@/lib/mqtt';
import { generatePayload } from '@/lib/display/sports-caster';
import { effectivePrepSec, getCost, ProductsConfig } from '@/lib/products-config-types';

async function getChargeAmount(duration: number, partySize: number): Promise<number> {
  const supabase = await createClient();
  const { data: pricesRow } = await supabase.from('settings').select('value').eq('key', 'prices').single();
  const rates: Record<string, number> = pricesRow?.value ? JSON.parse(pricesRow.value) : { '30': 150, '60': 300, '90': 450 };
  const config: ProductsConfig = { matchTypes: [], durations: [], rates, prepTimeSec: 0 };
  const cost = getCost(config, duration, partySize);
  if (cost === 0) throw new Error(`No price configured for ${duration} min`);
  return cost;
}

export async function finalizeBooking(entryId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('id', entryId)
    .single();
  if (!entry) return { success: false, error: 'Queue entry not found' };

  if (entry.status !== 'offered') return { success: false, error: 'Offer already processed' };

  if (new Date(entry.expires_at) < new Date()) {
    await expireOffer(entryId);
    return { success: false, error: 'Offer expired' };
  }

  const { data: member } = await supabase
    .from('members')
    .select('status')
    .eq('id', entry.member_id)
    .single();
  if (!member || member.status !== 'Active') {
    await supabase.from('queue_entries').update({ status: 'insufficient_credits', updated_at: new Date().toISOString() }).eq('id', entryId);
    return { success: false, error: 'Member not active' };
  }

  const charge = await getChargeAmount(entry.duration, entry.party_size);

  const { data: prepRow } = await supabase.from('settings').select('value').eq('key', 'preparationTime').single();
  const prepSec = parseInt(prepRow?.value ?? '300', 10);
  const effectivePrep = effectivePrepSec(entry.duration, isNaN(prepSec) ? 300 : prepSec);

  const now = new Date();
  const end = new Date(now.getTime() + effectivePrep * 1000 + entry.duration * 60_000);
  if (!entry.court_id || !(await isSlotAvailable(entry.court_id, now, end, entry.id))) {
    await supabase.from('queue_entries').update({ status: 'waiting', court_id: null, expires_at: null, updated_at: new Date().toISOString() }).eq('id', entryId);
    return { success: false, error: 'Court no longer available' };
  }

  const { data: court } = await supabase.from('courts').select('name').eq('id', entry.court_id).single();
  const playerIds: string[] = typeof entry.player_ids === 'string' ? JSON.parse(entry.player_ids) : entry.player_ids;
  const { data: rfidCards } = await supabase
    .from('rfid_cards')
    .select('uid, member_id')
    .in('member_id', playerIds)
    .eq('status', 'Active');

  const rfidMap = new Map((rfidCards ?? []).map(r => [r.member_id, r.uid]));
  const chargePerPerson = Math.round(charge / playerIds.length);
  const players = playerIds.map((pid, i) => ({
    rfid: rfidMap.get(pid) || '',
    team: entry.party_size === 4 ? (i < 2 ? 'Team A' : 'Team B') : null,
    charge_amount: chargePerPerson,
  }));

  const { data: gameId, error: gameErr } = await supabase.rpc('register_game', {
    p_court_name: court?.name ?? '',
    p_match_type: entry.party_size === 4 ? '2v2' : '1v1',
    p_duration: entry.duration,
    p_players: JSON.stringify(players),
  });

  if (gameErr) {
    if (gameErr.message?.toLowerCase().includes('insufficient')) {
      await supabase.from('queue_entries').update({ status: 'insufficient_credits', updated_at: new Date().toISOString() }).eq('id', entryId);
    } else {
      await supabase.from('queue_entries').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', entryId);
    }
    return { success: false, error: gameErr.message };
  }

  if (entry.match_title && gameId) {
    await supabase.from('games').update({ match_title: entry.match_title }).eq('id', gameId);
  }

  await supabase.from('queue_entries').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', entryId);

  const { data: gameData } = await supabase.from('games').select('start_time').eq('id', gameId).single();

  const entryMatchType = entry.party_size === 4 ? '2v2' : '1v1';
  await publishDisplay(entry.court_id, generatePayload(entry.court_id, {
    current: {
      name: entry.match_title || '',
      startTime: gameData?.start_time || new Date().toISOString(),
      durationMinutes: entry.duration,
      matchTitle: entry.match_title || '',
      matchType: entryMatchType,
    },
    upcoming: []
  }));

  return { success: true };
}

export async function declineOffer(entryId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('queue_entries').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', entryId);
}

export async function expireOffer(entryId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('queue_entries').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', entryId);
}
