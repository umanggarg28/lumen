import { NextResponse } from 'next/server';
import { metricsSnapshot } from '../../../lib/metrics';

export const runtime = 'nodejs';

// Aggregate generation-quality telemetry. `faithfulnessRejects` = questions that
// passed structural validation but were caught by the faithfulness judge — i.e.
// what the structural-only pipeline would have served.
export async function GET() {
  return NextResponse.json(metricsSnapshot());
}
