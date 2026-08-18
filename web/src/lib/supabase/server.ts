import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createFetchWithTimeout } from '../utils/fetch'
import { withTimeout } from '../utils/timeout'

/**
 * If using Fluid compute: Don't put this client in a global variable. Always create a new client within each
 * function when using it.
 */
export async function createClient() {
  const cookieStore = await withTimeout(
    cookies(),
    10000,
    () => { throw new Error('cookies() timeout'); }
  );

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
      global: {
        fetch: createFetchWithTimeout(10000),
      },
    }
  );

  if (process.env.PLAYWRIGHT_TEST_BYPASS_AUTH === '1') {
    const originalGetUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (jwt?: string) => {
      if (jwt) return originalGetUser(jwt);
      return {
        data: {
          user: {
            id: 'mock-user-123',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        },
        error: null
      } as any;
    };
  }

  return client;
}
