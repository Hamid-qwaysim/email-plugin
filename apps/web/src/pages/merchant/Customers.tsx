import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, PageHeader, CardSkeleton, Section } from '../../components/ui';
import { Donut } from '../../components/charts';

interface Visitor {
  id: string;
  anon_id: string;
  intent_score: number;
  intent_reason: string | null;
  country: string | null;
  band: string;
}

const bandTone = (b: string) => (b === 'high' ? 'ok' : b === 'cold' ? 'off' : 'warn') as 'ok' | 'off' | 'warn';
const bandColor: Record<string, string> = { high: '#0f9d58', warm: '#b7791f', browsing: '#5b54f0', cold: '#9aa1b2' };

export function MerchantCustomers() {
  const { storeId, loading } = useFirstStore();
  const [rows, setRows] = useState<Visitor[] | null>(null);

  useEffect(() => {
    if (!storeId) return;
    api<{ visitors: Visitor[] }>(`/merchant/stores/${storeId}/visitors`).then((r) => setRows(r.data?.visitors ?? []));
  }, [storeId]);

  if (loading || (storeId && rows === null)) return <CardSkeleton rows={6} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  if (rows!.length === 0) {
    return (
      <>
        <PageHeader title="Customers & Visitors" />
        <EmptyState title="No visitors tracked yet" icon="👀" hint="Once the plugin is connected and tracking, visitors and their intent scores appear here." />
      </>
    );
  }

  const dist = ['high', 'warm', 'browsing', 'cold'].map((b) => ({
    label: b, value: rows!.filter((v) => v.band === b).length, color: bandColor[b]!,
  })).filter((s) => s.value > 0);

  return (
    <>
      <PageHeader title="Customers & Visitors" sub={`${rows!.length} tracked`} />
      <div className="grid grid--2" style={{ gridTemplateColumns: '1fr 1.6fr' }}>
        <Section title="Intent distribution">
          <Donut segments={dist} />
        </Section>
        <Section title="Top intent visitors">
          <table className="table">
            <thead><tr><th>Visitor</th><th>Intent</th><th>Band</th><th>Why</th></tr></thead>
            <tbody>
              {rows!.slice(0, 12).map((v) => (
                <tr key={v.id}>
                  <td className="muted"><code>{v.anon_id.slice(0, 10)}</code></td>
                  <td><strong>{v.intent_score}</strong></td>
                  <td><Badge tone={bandTone(v.band)}>{v.band}</Badge></td>
                  <td className="muted" style={{ maxWidth: 280 }}>{v.intent_reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </>
  );
}
