import { useEffect, useState } from 'react';
import { api, formatCents } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, PageHeader, CardSkeleton, Stat, useToast } from '../../components/ui';

interface Insight {
  key: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  recommendedAction: string;
  estImpactCents: number;
}

const sevTone = (s: string) => (s === 'critical' ? 'warn' : s === 'warn' ? 'warn' : 'off') as 'warn' | 'off';

export function MerchantStoreDoctor() {
  const { storeId, loading } = useFirstStore();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const toast = useToast();

  useEffect(() => {
    if (!storeId) return;
    api<{ insights: Insight[] }>(`/merchant/stores/${storeId}/store-doctor`).then((r) => setInsights(r.data?.insights ?? []));
  }, [storeId]);

  if (loading || (storeId && insights === null)) return <CardSkeleton rows={4} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  const totalImpact = insights!.reduce((s, i) => s + i.estImpactCents, 0);

  return (
    <>
      <PageHeader title="Store Doctor" sub="AI-prioritized opportunities for your store" />
      {insights!.length === 0 ? (
        <EmptyState title="No issues detected yet" icon="🩺" hint="As your store collects traffic and orders, prioritized opportunities appear here." />
      ) : (
        <>
          <div className="grid grid--3">
            <Stat label="Open insights" value={insights!.length} icon="🩺" />
            <Stat label="Est. recoverable impact" value={formatCents(totalImpact)} icon="💡" />
            <Stat label="Applied" value={Object.values(applied).filter(Boolean).length} icon="✅" />
          </div>
          <div className="grid mt-4">
            {insights!.map((i) => (
              <div key={i.key} className="card">
                <div className="card__head">
                  <h3>{i.title}</h3>
                  <Badge tone={sevTone(i.severity)}>{i.severity}</Badge>
                </div>
                <p className="muted" style={{ marginTop: 0 }}>{i.body}</p>
                <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div><strong>Recommended:</strong> {i.recommendedAction}{i.estImpactCents > 0 && <span className="muted"> · est. {formatCents(i.estImpactCents)}</span>}</div>
                  <button className="btn btn--primary btn--sm" disabled={applied[i.key]}
                    onClick={() => { setApplied((a) => ({ ...a, [i.key]: true })); toast.push('Suggested action queued', 'ok'); }}>
                    {applied[i.key] ? 'Applied' : 'Apply suggestion'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
