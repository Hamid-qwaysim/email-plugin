import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { EmptyState, Spinner } from '../../components/ui';

interface Coupon {
  id: string;
  code: string;
  type: string;
  amount: number;
  status: string;
  source: string;
  used_count: number;
  ai_rationale: string | null;
}

export function MerchantCoupons() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);

  useEffect(() => {
    api<{ stores: { id: string }[] }>('/merchant/stores').then((res) => {
      const store = res.data?.stores?.[0];
      if (!store) return setCoupons([]);
      api<{ coupons: Coupon[] }>(`/merchant/stores/${store.id}/coupons`).then((r) => setCoupons(r.data?.coupons ?? []));
    });
  }, []);

  if (coupons === null) return <Spinner />;

  return (
    <>
      <div className="main__head"><h1>Coupons</h1></div>
      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" hint="AI coupons are generated automatically during cart recovery, or create them in a campaign." />
      ) : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Code</th><th>Type</th><th>Amount</th><th>Used</th><th>Source</th><th>Why</th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td><code>{c.code}</code></td>
                  <td>{c.type}</td>
                  <td>{c.amount}</td>
                  <td>{c.used_count}</td>
                  <td>{c.source}</td>
                  <td className="muted">{c.ai_rationale ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
