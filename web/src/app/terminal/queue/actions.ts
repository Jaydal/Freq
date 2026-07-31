'use server';

import { createClient } from '@/lib/supabase/server';
import { getBoardSnapshot } from '@/lib/queue/board-snapshot';

export async function fetchBoardSnapshot() {
  const supabase = await createClient();
  
  // Lazily trigger the backend queue processor so that the queue advances 
  // even if the physical hardware heartbeat isn't pinging the server.
  fetch(new URL('/api/display/publish-all', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').toString(), { method: 'POST' }).catch(console.error);

  return getBoardSnapshot(supabase);
}
