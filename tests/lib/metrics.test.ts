import { describe, it, expect, beforeEach } from 'vitest';
import { recordGate, metricsSnapshot, resetMetrics } from '../../src/lib/metrics';

describe('generation metrics', () => {
  beforeEach(() => resetMetrics());

  it('counts faithfulness rejections separately — each is a question the structural-only pipeline would have served', () => {
    recordGate({ kind: 'served', objectiveId: 'o1', attempts: 1 });
    recordGate({ kind: 'faithfulness_reject', objectiveId: 'o2', attempt: 1, detail: 'answer not supported' });
    recordGate({ kind: 'served', objectiveId: 'o2', attempts: 2 });

    const s = metricsSnapshot();
    expect(s.served).toBe(2);
    expect(s.faithfulnessRejects).toBe(1);
    expect(s.structuralRejects).toBe(0);
    expect(s.avgAttemptsPerServed).toBe(1.5);
  });

  it('starts empty after reset', () => {
    recordGate({ kind: 'served', objectiveId: 'o1', attempts: 1 });
    resetMetrics();
    expect(metricsSnapshot().served).toBe(0);
  });
});
