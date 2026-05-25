import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, Spinner } from '../../components/ui';

interface Visitor {
  id: string;
  anon_id: string;
  intent_score: number;
  intent_reason: string | null;
  country: string | null;
  band: string;
}

const bandTone = (b: string) => (b === 'high' ? 'ok' : b === 'cold' ? 'off' : 'warn') as 'ok' | 'off' | 'warn';

export function MerchantCustomers() {
  const { storeId, loading } = useFirstStore();
  const [rows, setRows] = useState<Visitor[] | null>(null);

  useEffect(() => {
    if (!storeId) return;
    api<{ visitors: Visitor[] }>(`/merchant/stores/${storeId}/visitors`).then((r) => setRows(r.data?.visitors ?? []));
  }, [storeId]);

  if (loading || (storeId && rows === null)) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  return (
    <>
      <div className="main__head"><h1>Customers &amp; Visitors</h1></div>
      {rows!.length === 0 ? (
        <EmptyState title="No visitors tracked yet" hint="Once the plugin is connected and tracking, visitors and their intent scores appear here." />
      ) : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Visitor</th><th>Intent</th><th>Band</th><th>Why</th><th>Country</th></tr></thead>
            <tbody>
              {rows!.map((v) => (
                <tr key={v.id}>
                  <td className="muted"><code>{v.anon_id.slice(0, 12)}</code></td>
                  <td><strong>{v.intent_score}</strong></td>
                  <td><Badge tone={bandTone(v.band)}>{v.band}</Badge></td>
                  <td className="muted">{v.intent_reason ?? '—'}</td>
                  <td>{v.country ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
