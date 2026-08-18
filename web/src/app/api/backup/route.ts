import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const tables = ['courts', 'settings', 'members', 'wallets', 'rfid_cards'];
  const backupData: Record<string, any[]> = {};

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Error fetching table ${table}:`, error);
      return NextResponse.json({ error: `Failed to fetch ${table}` }, { status: 500 });
    }
    backupData[table] = data || [];
  }

  return NextResponse.json(backupData);
}

export async function POST(req: Request) {
  try {
    const backupData = await req.json();
    const supabase = await createClient();
    
    // Validate backup data format
    if (!backupData || typeof backupData !== 'object') {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    const tables = ['courts', 'settings', 'members', 'wallets', 'rfid_cards'];
    
    for (const table of tables) {
      if (backupData[table] && Array.isArray(backupData[table]) && backupData[table].length > 0) {
        const { error } = await supabase.from(table).upsert(backupData[table]);
        if (error) {
          console.error(`Error restoring table ${table}:`, error);
          return NextResponse.json({ error: `Failed to restore ${table}: ${error.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Restore completed successfully' });
  } catch (error: any) {
    console.error('Error parsing backup payload:', error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
