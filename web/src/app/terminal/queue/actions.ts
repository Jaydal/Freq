'use server';

import { createClient } from '@/lib/supabase/server';
import { getBoardSnapshot } from '@/lib/queue/board-snapshot';

export async function fetchBoardSnapshot() {
  const supabase = await createClient();
  return getBoardSnapshot(supabase);
}
