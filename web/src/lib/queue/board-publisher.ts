import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBoardSnapshot } from './board-snapshot';
import { completeExpiredGames, processCourtQueue } from './queue-processor';
import { publishBoard } from '@/lib/mqtt';

let g = globalThis as typeof globalThis & {
  _boardServiceClient?: SupabaseClient;
};

function serviceClient(): SupabaseClient | null {
  if (g._boardServiceClient) return g._boardServiceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  g._boardServiceClient = createClient(url, key, { auth: { persistSession: false } });
  return g._boardServiceClient;
}

export async function publishBoardOnce(): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;
  try {
    const freedCourts = await completeExpiredGames();
    for (const courtId of freedCourts) {
      await processCourtQueue(courtId);
    }
    const snapshot = await getBoardSnapshot(supabase);
    await publishBoard(JSON.stringify(snapshot));
  } catch (err) {
    console.error('[board-publisher]', err instanceof Error ? err.message : err);
  }
}
