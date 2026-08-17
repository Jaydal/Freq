import { createBrowserClient } from '@supabase/ssr'
import { createFetchWithTimeout } from '../utils/fetch'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        fetch: createFetchWithTimeout(10000),
      },
    }
  );
}
