import { NextResponse } from 'next/server';
import { publishAllDisplays } from '@/lib/display/publish-all';

async function publishAll() {
  const res = await publishAllDisplays();
  if (!res.ok) {
    return NextResponse.json(
      { error: `Publish failed (${res.failed}/${res.total})`, failed: res.failed, total: res.total },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, ...res });
}

export async function GET() {
  return publishAll();
}

export async function POST() {
  return publishAll();
}
