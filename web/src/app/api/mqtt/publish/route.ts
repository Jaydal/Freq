import { NextResponse } from 'next/server';
import { publishDisplay, DisplayPayload } from '@/lib/mqtt';
import { z } from 'zod';

const schema = z.object({
  courtId: z.string(),
  state: z.enum(['OPEN', 'PLAYING', 'MAINTENANCE']).default('MAINTENANCE'),
  text: z.string().optional(),
  pages: z.array(z.object({
    text: z.string(),
    color: z.string().optional(),
    effect: z.enum(['SCROLL', 'STATIC', 'BLINK']).optional(),
    durationSeconds: z.number().optional(),
  })).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
  }

  const pages = result.data.pages ?? (result.data.text
    ? [{ text: result.data.text, color: '#FFFFFF', effect: 'SCROLL' as const, durationSeconds: 10 }]
    : [{ text: `${result.data.courtId}`, color: '#FFFFFF', effect: 'SCROLL' as const, durationSeconds: 10 }]);

  const payload: DisplayPayload = {
    courtId: result.data.courtId,
    action: 'MANUAL_OVERRIDE',
    state: result.data.state,
    schedule: { upcoming: [] },
    serverTime: Math.floor(Date.now() / 1000),
    display: { pages },
  };

  const ok = await publishDisplay(result.data.courtId, payload);
  return NextResponse.json({ published: ok });
}
