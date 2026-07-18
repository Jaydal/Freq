import { NextResponse } from 'next/server';

export async function GET() {
  const brokerUrl = process.env.MQTT_BROKER_URL || '';
  const username = process.env.MQTT_USERNAME || '';
  const password = process.env.MQTT_PASSWORD || '';

  if (!brokerUrl || !username || !password) {
    return NextResponse.json({ enabled: false });
  }

  const wsUrl = brokerUrl
    .replace(/^mqtts:\/\//, 'wss://')
    .replace(/:8883$/, ':8884') + '/mqtt';

  return NextResponse.json({
    enabled: true,
    url: wsUrl,
    username,
    password,
    topic: 'freq/board',
  });
}
