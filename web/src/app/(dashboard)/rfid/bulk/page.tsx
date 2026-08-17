import { createClient } from '@/lib/supabase/server';
import BulkRegisterClient from './bulk-register-client';

export const dynamic = 'force-dynamic';

export default async function BulkRFIDPage() {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from('rfid_cards')
    .select('*, members(*)')
    .order('assigned_date', { ascending: false, nullsFirst: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-150">Bulk RFID Registration</h1>
        <p className="text-sm text-zinc-500 mt-1">Tap or scan cards to register them in bulk</p>
      </div>
      <BulkRegisterClient initialCards={cards ?? []} />
    </div>
  );
}