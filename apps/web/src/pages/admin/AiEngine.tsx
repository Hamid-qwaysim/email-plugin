import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, PageHeader, CardSkeleton, Section, Stat } from '../../components/ui';

interface Job { id: string; store_id: string | null; kind: string; model: string | null; provider: string | null; status: string; cost_tokens: number | null; created_at: number }

export function AdminAiEngine() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [totals, setTotals] = useState({ tokens: 0, n: 0 });
  useEffect(() => {
    api<{ jobs: Job[]; totalTokens: number; totalJobs: number }>('/admin/ai-jobs').then((r) => {
      setJobs(r.data?.jobs ?? []); setTotals({ tokens: r.data?.totalTokens ?? 0, n: r.data?.totalJobs ?? 0 });
    });
  }, []);
  if (jobs === null) return <CardSkeleton rows={6} />;
  return (
    <>
      <PageHeader title="AI Engine" sub="Generation jobs, models, and token cost" />
      <div className="grid grid--3">
        <Stat label="Total AI jobs" value={totals.n} icon="🤖" />
        <Stat label="Total tokens" value={totals.tokens.toLocaleString()} icon="🔢" />
        <Stat label="Est. cost" value={`$${((totals.tokens / 1000) * 0.002).toFixed(2)}`} sub="@ $0.002/1K (illustrative)" icon="💵" />
      </div>
      <div className="mt-4">
        <Section title="Recent jobs">
          {jobs.length === 0 ? <p className="muted">No AI jobs yet.</p> : (
            <table className="table">
              <thead><tr><th>When</th><th>Kind</th><th>Provider</th><th>Model</th><th>Status</th><th>Tokens</th></tr></thead>
              <tbody>{jobs.map((j) => <tr key={j.id}><td className="muted">{new Date(j.created_at).toLocaleString()}</td><td>{j.kind}</td><td>{j.provider ?? '—'}</td><td>{j.model ?? '—'}</td><td><Badge tone={j.status === 'done' ? 'ok' : 'warn'}>{j.status}</Badge></td><td>{j.cost_tokens ?? '—'}</td></tr>)}</tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}
