'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '../../components/Spinner';

interface Catch {
  objectiveId: string;
  question: string;
  reason: string;
  at: string;
}

interface Metrics {
  served: number;
  structuralRejects: number;
  faithfulnessRejects: number;
  failures: number;
  faithfulnessRejectsPerServed: number;
  avgAttemptsPerServed: number;
  catches: Catch[];
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function ObservabilityPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/metrics');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setMetrics((await res.json()) as Metrics);
    } catch {
      setError('Could not load generation metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount. State is only set after the await, so the initial render isn't
  // interrupted by a synchronous state update.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/metrics');
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Metrics;
        if (active) setMetrics(data);
      } catch {
        if (active) setError('Could not load generation metrics.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:opacity-70">
          ← Back to lessons
        </Link>
        <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      <span className="chip mt-6 inline-block" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
        Generation quality
      </span>
      <h1 className="mt-4 text-3xl font-bold">Question self-evaluation</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Every generated question passes a structural check and then a faithfulness check — a second model that
        verifies the proposed answer is actually supported by the cited source. Because the faithfulness check
        runs only after the structural one passes, each catch below is a question the structural-only pipeline
        would have served.
      </p>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Spinner label="Loading metrics…" />
        </div>
      ) : error ? (
        <div
          className="mt-8 flex items-center justify-between rounded-lg border p-4 text-sm"
          style={{ background: 'var(--bad-bg)', borderColor: 'var(--bad-border)', color: 'var(--text)' }}
          role="alert"
        >
          <span>{error}</span>
          <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={load}>
            Retry
          </button>
        </div>
      ) : !metrics ? null : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Questions served" value={metrics.served} />
            <Stat label="Caught by faithfulness" value={metrics.faithfulnessRejects} hint="would have been served" />
            <Stat label="Caught by structure" value={metrics.structuralRejects} hint="malformed" />
            <Stat label="Avg attempts / served" value={metrics.avgAttemptsPerServed || 0} />
          </div>

          <h2 className="mt-10 text-lg font-semibold">Recent catches</h2>
          {metrics.catches.length === 0 ? (
            <div className="card mt-3 p-6 text-sm text-muted">
              No catches recorded yet. Generate a few lessons and they&apos;ll appear here.
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {metrics.catches.map((c, i) => (
                <li key={i} className="card p-4" style={{ borderLeft: '4px solid var(--bad)' }}>
                  <p className="font-medium">{c.question}</p>
                  <p className="mt-1.5 text-sm text-muted">
                    <span style={{ color: 'var(--bad)' }}>Rejected:</span> {c.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
