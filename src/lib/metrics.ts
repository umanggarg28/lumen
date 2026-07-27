/**
 * Lightweight in-process telemetry for the question-generation gates.
 *
 * The point of measurement: the faithfulness gate runs AFTER structural validation
 * passes, so every `faithfulness_reject` is a question the structural-only pipeline
 * WOULD have served. Counting them measures the gate's marginal value directly, and
 * each catch is kept so it can be inspected.
 *
 * Caveat (honest): this counts how often the judge *fires*, not whether the judge
 * is *right*. Proving quality improvement needs ground truth (human / stronger model).
 */

export type GateEvent =
  | { kind: 'structural_reject'; objectiveId: string; attempt: number; detail: string }
  | { kind: 'faithfulness_reject'; objectiveId: string; attempt: number; detail: string; question: string }
  | { kind: 'served'; objectiveId: string; attempts: number }
  | { kind: 'failed'; objectiveId: string; attempts: number };

/** A question the faithfulness judge rejected — kept so the catch can be shown. */
export interface Catch {
  objectiveId: string;
  question: string;
  reason: string;
  at: string;
}

interface State {
  served: number;
  structuralRejects: number;
  faithfulnessRejects: number;
  failures: number;
  attemptsTotal: number;
  catches: Catch[];
}

const state: State = {
  served: 0,
  structuralRejects: 0,
  faithfulnessRejects: 0,
  failures: 0,
  attemptsTotal: 0,
  catches: [],
};

export function recordGate(event: GateEvent): void {
  switch (event.kind) {
    case 'structural_reject':
      state.structuralRejects++;
      break;
    case 'faithfulness_reject':
      state.faithfulnessRejects++;
      state.catches.unshift({
        objectiveId: event.objectiveId,
        question: event.question,
        reason: event.detail,
        at: new Date().toISOString(),
      });
      if (state.catches.length > 20) state.catches.pop();
      break;
    case 'served':
      state.served++;
      state.attemptsTotal += event.attempts;
      break;
    case 'failed':
      state.failures++;
      break;
  }

  // Structured server log for live visibility (quiet during tests).
  if (process.env.NODE_ENV !== 'test') console.log('[gen]', JSON.stringify(event));
}

export function metricsSnapshot() {
  return {
    served: state.served,
    structuralRejects: state.structuralRejects,
    faithfulnessRejects: state.faithfulnessRejects,
    failures: state.failures,
    catches: state.catches,
    // Of the questions we served, how many extra "catches" did the faithfulness gate make?
    faithfulnessRejectsPerServed: state.served
      ? +(state.faithfulnessRejects / state.served).toFixed(3)
      : 0,
    avgAttemptsPerServed: state.served ? +(state.attemptsTotal / state.served).toFixed(2) : 0,
  };
}

export function resetMetrics(): void {
  state.served = 0;
  state.structuralRejects = 0;
  state.faithfulnessRejects = 0;
  state.failures = 0;
  state.attemptsTotal = 0;
  state.catches = [];
}
