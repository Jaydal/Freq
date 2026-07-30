import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(request: Request) {
  const { key, value } = await request.json();
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('settings').upsert(
    { key, value },
    { onConflict: 'key' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const { createClient: createAdminClient } = require('@supabase/supabase-js');
  const supabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('settings').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
