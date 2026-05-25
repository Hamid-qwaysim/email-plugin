import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { EmptyState, PageHeader, CardSkeleton, Section } from '../../components/ui';

interface Step { from: string; to: string; enter: number; exit: number; dropPct: number }
interface Report { steps: Step[]; worstStep: Step | null; reasons: string[] }

const labels: Record<string, string> = {
  product_view: 'Product views', add_to_cart: 'Added to cart', checkout_started: 'Checkout started', purchase: 'Purchased',
};

export function MerchantFriction() {
  const { storeId, loading } = useFirstStore();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!storeId) return;
    api<Report>(`/merchant/stores/${storeId}/friction`).then((r) => setReport(r.data ?? null));
  }, [storeId]);

  if (loading || (storeId && !report)) return <CardSkeleton rows={4} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  const maxEnter = Math.max(1, ...report!.steps.map((s) => s.enter));
  const stages = [
    { key: 'product_view', value: report!.steps[0]?.enter ?? 0 },
    { key: 'add_to_cart', value: report!.steps[1]?.enter ?? 0 },
    { key: 'checkout_started', value: report!.steps[2]?.enter ?? 0 },
    { key: 'purchase', value: (report!.steps[2]?.enter ?? 0) - (report!.steps[2]?.exit ?? 0) },
  ];

  return (
    <>
      <PageHeader title="Checkout Friction" sub="Where shoppers drop off" />
      <div className="grid grid--2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Section title="Conversion funnel">
          {stages.map((s, i) => (
            <div className="funnel__step" key={s.key}>
              <div className="funnel__bar" style={{ width: `${Math.max(8, (s.value / maxEnter) * 100)}%` }}>
                {labels[s.key]} · {s.value}
              </div>
              {i < report!.steps.length && (
                <div className="funnel__meta">
                  <span>drop-off</span>
                  <span style={{ color: report!.steps[i]!.dropPct > 60 ? 'var(--danger)' : 'inherit' }}>{report!.steps[i]!.dropPct}%</span>
                </div>
              )}
            </div>
          ))}
        </Section>
        <Section title="Likely friction reasons">
          {report!.worstStep ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Biggest drop: <strong>{labels[report!.worstStep.from]} → {labels[report!.worstStep.to]}</strong> ({report!.worstStep.dropPct}%)
              </p>
              <ul style={{ paddingLeft: 18 }}>
                {report!.reasons.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}
              </ul>
            </>
          ) : (
            <p className="muted">Not enough traffic yet to pinpoint friction.</p>
          )}
        </Section>
      </div>
    </>
  );
}
