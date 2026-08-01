import { createClient } from '@/lib/supabase/server';
import { isOverlapping, type CourtInfo } from './index';


export async function findAvailableCourt(
  _requestedStart: Date,
  duration: number,
  partySize: number,
  excludeCourtId?: string
): Promise<CourtInfo | null> {
  const supabase = await createClient();
  const now = new Date();
  const end = new Date(now.getTime() + duration * 60_000);

  const { data: courts } = await supabase
    .from('courts')
    .select('*')
    .order('name', { ascending: true });

  if (!courts) return null;

  for (const court of courts) {
    if (excludeCourtId && court.id === excludeCourtId) continue;
    const slotFree = await isSlotAvailable(court.id, now, end);
    if (slotFree) return { id: court.id, name: court.name, status: court.status };
  }

  return null;
}

export async function isSlotAvailable(
  courtId: string,
  start: Date,
  end: Date,
  excludeQueueEntryId?: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data: overlapping } = await supabase
    .from('games')
    .select('id')
    .eq('court_id', courtId)
    .in('status', ['Scheduled', 'In Progress'])
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString());

  if (overlapping && overlapping.length > 0) return false;

  // Also check if there are any active offers for this court that overlap
  const { data: offered } = await supabase
    .from('queue_entries')
    .select('id, requested_start, duration, expires_at')
    .eq('court_id', courtId)
    .eq('status', 'offered');
  
  if (offered && offered.length > 0) {
    for (const offer of offered) {
      if (excludeQueueEntryId && offer.id === excludeQueueEntryId) continue;
      if (offer.expires_at && new Date(offer.expires_at).getTime() <= start.getTime()) continue;
      
      const offerStart = new Date(offer.requested_start);
      const offerEnd = new Date(offerStart.getTime() + offer.duration * 60_000);
      if (isOverlapping(start, end, offerStart, offerEnd)) {
        return false;
      }
    }
  }

  const { data: straddling } = await supabase
    .from('games')
    .select('id, duration, start_time, status')
    .eq('court_id', courtId)
    .in('status', ['Scheduled', 'In Progress'])
    .lt('start_time', start.toISOString());

  if (!straddling) return true;

  for (const game of straddling) {
    // If it's a Scheduled game that is past its start time, it's a no-show ("done already")
    if ((game as any).status === 'Scheduled' && new Date(game.start_time).getTime() <= start.getTime()) {
      continue;
    }

    const gameEnd = new Date(
      new Date(game.start_time).getTime() + game.duration * 60_000
    );
    if (isOverlapping(start, end, new Date(game.start_time), gameEnd)) {
      return false;
    }
  }

  return true;
}
