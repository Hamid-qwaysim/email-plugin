import { useEffect, useState } from 'react';
import { api, formatCents } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, Spinner } from '../../components/ui';

interface Insight {
  key: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  recommendedAction: string;
  estImpactCents: number;
}

export function MerchantStoreDoctor() {
  const { storeId, loading } = useFirstStore();
  const [insights, setInsights] = useState<Insight[] | null>(null);

  useEffect(() => {
    if (!storeId) return;
    api<{ insights: Insight[] }>(`/merchant/stores/${storeId}/store-doctor`).then((r) => setInsights(r.data?.insights ?? []));
  }, [storeId]);

  if (loading || (storeId && insights === null)) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  return (
    <>
      <div className="main__head"><h1>Store Doctor</h1></div>
      {insights!.length === 0 ? (
        <EmptyState title="No issues detected yet" hint="As your store collects traffic and orders, the Store Doctor surfaces prioritized opportunities here." />
      ) : (
        <div className="grid">
          {insights!.map((i) => (
            <div key={i.key} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{i.title}</h3>
                <Badge tone={i.severity === 'critical' ? 'warn' : i.severity === 'warn' ? 'warn' : 'off'}>{i.severity}</Badge>
              </div>
              <p className="muted">{i.body}</p>
              <p><strong>Recommended:</strong> {i.recommendedAction}</p>
              {i.estImpactCents > 0 && <p className="muted">Estimated impact: {formatCents(i.estImpactCents)}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
