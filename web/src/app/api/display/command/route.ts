import { NextResponse } from 'next/server';
import { connectMqtt, publishCommand } from '@/lib/mqtt';

export async function POST(request: Request) {
  const connected = await connectMqtt();
  if (!connected) {
    return NextResponse.json({ error: 'MQTT not connected' }, { status: 503 });
  }

  const { mac, action, courtId, display } = await request.json();
  if (!mac || !action) {
    return NextResponse.json({ error: 'mac and action are required' }, { status: 400 });
  }

  const command: Record<string, unknown> = { action };
  if (action === 'SET_COURT_ID') {
    if (!courtId) return NextResponse.json({ error: 'courtId required' }, { status: 400 });
    command.courtId = courtId;
  }
  if (action === 'OVERRIDE') {
    if (!display) return NextResponse.json({ error: 'display payload required' }, { status: 400 });
    command.display = display;
  }

  publishCommand(mac, command);

  return NextResponse.json({ ok: true });
}