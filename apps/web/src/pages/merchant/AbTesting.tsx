import { useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, PageHeader, Section, Spinner } from '../../components/ui';

interface Result { decided: boolean; winnerId: string | null; confidence: number; reason: string }
interface Row { id: string; sent: number; conversions: number }

export function MerchantAbTesting() {
  const { storeId, loading } = useFirstStore();
  const [variants, setVariants] = useState<Row[]>([
    { id: 'A', sent: 2000, conversions: 180 },
    { id: 'B', sent: 2000, conversions: 240 },
  ]);
  const [result, setResult] = useState<Result | null>(null);

  function update(i: number, field: 'sent' | 'conversions', value: number) {
    setVariants((v) => v.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function addVariant() {
    setVariants((v) => [...v, { id: String.fromCharCode(65 + v.length), sent: 0, conversions: 0 }]);
  }
  async function evaluate() {
    if (!storeId) return;
    const res = await api<Result>(`/merchant/stores/${storeId}/ab-tests/evaluate`, { method: 'POST', body: { variants } });
    setResult(res.data ?? null);
  }

  if (loading) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  return (
    <>
      <PageHeader title="A/B Testing" sub="Statistical winner selection (two-proportion z-test)" />
      <div className="grid grid--2" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <Section title="Variants" action={<button className="btn btn--ghost btn--sm" onClick={addVariant}>+ Variant</button>}>
          <table className="table">
            <thead><tr><th>Variant</th><th>Sent</th><th>Conversions</th><th>Rate</th></tr></thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={i}>
                  <td><strong>{v.id}</strong></td>
                  <td><input className="input" type="number" value={v.sent} style={{ width: 110 }} onChange={(e) => update(i, 'sent', Number(e.target.value))} /></td>
                  <td><input className="input" type="number" value={v.conversions} style={{ width: 110 }} onChange={(e) => update(i, 'conversions', Number(e.target.value))} /></td>
                  <td>{v.sent > 0 ? ((v.conversions / v.sent) * 100).toFixed(1) : '0'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn--primary mt-2" onClick={evaluate}>Evaluate</button>
        </Section>
        <Section title="Result">
          {!result ? (
            <p className="muted">Enter variant stats and click Evaluate.</p>
          ) : result.decided ? (
            <>
              <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                <Badge tone="ok">Winner: {result.winnerId}</Badge>
                <span className="muted">{(result.confidence * 100).toFixed(1)}% confidence</span>
              </div>
              <p>{result.reason}</p>
            </>
          ) : (
            <>
              <Badge tone="warn">No winner yet</Badge>
              <p className="mt-2">{result.reason}</p>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
