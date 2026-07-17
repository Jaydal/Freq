import { createClient } from '@/lib/supabase/server';
import { isSlotAvailable } from './booking-engine';
import { publishDisplay } from '@/lib/mqtt';
import { generatePayload } from '@/lib/display/sports-caster';
import { effectivePrepSec } from '@/lib/products-config-types';
import { finalizeBooking } from './reservation-service';

// W2: Store interval on globalThis to survive hot-reload without leaking.
const g = global as typeof globalThis & {
  _queueExpiryInterval?: ReturnType<typeof setInterval>;
};

export function startExpiryProcessor(): void {
  if (g._queueExpiryInterval) return;
  g._queueExpiryInterval = setInterval(() => {
    processExpiredGames().catch((err) => console.error('[queue-processor] Expiry cycle failed:', err));
  }, 30_000);
  processExpiredGames().catch((err) => console.error('[queue-processor] Startup expiry failed:', err));
}

export function stopExpiryProcessor(): void {
  if (g._queueExpiryInterval) {
    clearInterval(g._queueExpiryInterval);
    g._queueExpiryInterval = undefined;
  }
}

export async function processCourt(courtId: string): Promise<void> {
  const supabase = await createClient();

  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'preparationTime').single();
  const rawPrepSec = parseInt(settings?.value ?? '300', 10);
  const prepSec = isNaN(rawPrepSec) ? 300 : rawPrepSec;

  const { data: waiting } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('status', 'waiting')
    .or(`court_id.eq.${courtId},court_id.is.null`)
    .order('created_at', { ascending: true });

  if (waiting && waiting.length > 0) {
    for (const entry of waiting) {
      const now = new Date();
      const effectivePrep = effectivePrepSec(entry.duration, prepSec);
      const end = new Date(now.getTime() + effectivePrep * 1000 + entry.duration * 60_000);
      const available = await isSlotAvailable(courtId, now, end);

      if (available) {
        const { data: freshEntry } = await supabase
          .from('queue_entries')
          .select('status')
          .eq('id', entry.id)
          .single();

        if (!freshEntry || freshEntry.status !== 'waiting') {
          continue;
        }

        const { data: claimed } = await supabase
          .from('queue_entries')
          .update({ status: 'accepted', court_id: courtId, updated_at: new Date().toISOString() })
          .eq('id', entry.id)
          .eq('status', 'waiting')
          .select();

        if (claimed && claimed.length > 0) {
          const result = await finalizeBooking(entry.id, { bookCourt: true });
          if (!result.success) {
            console.error(`[queue-processor] Auto-book failed for entry ${entry.id}:`, result.error);
          }
        }

        // Booked this court; stop trying to fill it again.
        break;
      }
    }
  }

  // Always attempt to match remaining waiters against every other available
  // court. This must run even when THIS court had no eligible waiter (e.g. an
  // offer was declined/expired), otherwise waiters who prefer a different free
  // court would be stranded and the queue would appear "stuck".
  await processWaitingEntries();

  await publishDisplay(courtId, generatePayload(courtId, { current: null, upcoming: [] }));
}

export async function processWaitingEntries(): Promise<void> {
  const supabase = await createClient();

  const { data: waiting } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('status', 'waiting')
    .order('created_at', { ascending: true });

  if (!waiting || waiting.length === 0) return;

  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'preparationTime').single();
  const rawPrepSec = parseInt(settings?.value ?? '300', 10);
  const prepSec = isNaN(rawPrepSec) ? 300 : rawPrepSec;

  const { data: activeGames } = await supabase
    .from('games')
    .select('court_id, start_time, duration');

  // A court is "busy now" from its schedule: a game whose window
  // (start_time + prep + duration) still includes `now`. This is schedule-based
  // and does not depend on games.status being flipped to 'Completed'.
  const now = new Date();
  const busyCourts = new Set<string>();
  for (const g of (activeGames ?? [])) {
    if (!g.start_time) continue;
    const prep = effectivePrepSec(g.duration ?? 0, prepSec);
    const end = new Date(new Date(g.start_time).getTime() + prep * 1000 + (g.duration ?? 0) * 60_000);
    if (now < end) busyCourts.add(g.court_id);
  }

  const { data: allCourts } = await supabase
    .from('courts')
    .select('id')
    .order('name', { ascending: true });

  if (!allCourts) return;

  const availableCourts = allCourts.filter(c => !busyCourts.has(c.id));
  if (availableCourts.length === 0) return;

  for (const entry of waiting) {
    // Respect court preference: a waiter who chose a specific court may only be
    // booked onto THAT court. Only unpreferred (court_id IS NULL) waiters are
    // eligible for distribution across any available court. This keeps a
    // court-1-preferring waiter in the waiting list when a different court is
    // free, instead of silently being reassigned away from their choice.
    const candidateCourts = entry.court_id
      ? availableCourts.filter(c => c.id === entry.court_id)
      : availableCourts;

    for (const court of candidateCourts) {
      const now = new Date();
      const effectivePrep = effectivePrepSec(entry.duration, prepSec);
      const end = new Date(now.getTime() + effectivePrep * 1000 + entry.duration * 60_000);
      const slotAvailable = await isSlotAvailable(court.id, now, end);
      if (!slotAvailable) continue;

      const { data: freshEntry } = await supabase
        .from('queue_entries')
        .select('status')
        .eq('id', entry.id)
        .single();

      if (!freshEntry || freshEntry.status !== 'waiting') break;

      const { data: claimed } = await supabase
        .from('queue_entries')
        .update({ status: 'accepted', court_id: court.id, updated_at: new Date().toISOString() })
        .eq('id', entry.id)
        .eq('status', 'waiting')
        .select();

      if (claimed && claimed.length > 0) {
        const result = await finalizeBooking(entry.id, { bookCourt: true });
        if (!result.success) {
          console.error(`[queue-processor] Auto-book failed for entry ${entry.id}:`, result.error);
        }
        // Remove this court from the available pool for subsequent entries
        const idx = availableCourts.indexOf(court);
        if (idx >= 0) availableCourts.splice(idx, 1);
      }
      break;
    }
    if (availableCourts.length === 0) break;
  }
}

export async function processExpiredGames(): Promise<void> {
  const supabase = await createClient();
  const now = new Date();

  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'preparationTime').single();
  const rawPrepSec = parseInt(settings?.value ?? '300', 10);
  const prepSec = isNaN(rawPrepSec) ? 300 : rawPrepSec;

  // Status is derived from the schedule, so we no longer flip games.status ->
  // 'Completed' or courts.status -> 'Available' for the view. We only need to
  // detect courts whose schedule window has just ended and advance any waiting
  // entries onto them (a real register_game mutation). The board itself will
  // show these courts as free automatically via schedule derivation.
  const { data: active } = await supabase
    .from('games')
    .select('id, court_id, start_time, duration');

  if (!active) return;

  for (const game of active) {
    if (!game.start_time) continue;
    const effectivePrep = effectivePrepSec(game.duration, prepSec);
    const end = new Date(new Date(game.start_time).getTime() + effectivePrep * 1000 + game.duration * 60_000);
    if (end > now) continue;

    // Court's schedule ended: try to fill it from the waiting list.
    await processCourt(game.court_id);
  }

  await processWaitingEntries();
}
