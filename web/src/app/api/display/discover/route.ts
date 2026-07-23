import { NextResponse } from 'next/server';
import { connectMqtt, collectDiscoveryResponses } from '@/lib/mqtt';

export async function POST() {
  const connected = await connectMqtt();
  if (!connected) {
    return NextResponse.json({ error: 'MQTT not connected' }, { status: 503 });
  }

  const displays = await collectDiscoveryResponses(3000);

  return NextResponse.json({ displays });
}
