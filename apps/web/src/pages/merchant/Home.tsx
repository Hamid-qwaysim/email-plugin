import { useEffect, useState } from 'react';
import { api, formatCents } from '../../lib/api';
import { Stat, EmptyState, Spinner } from '../../components/ui';

interface StoreRow {
  id: string;
  name: string;
  domain: string;
  connection_health: string;
}
interface Overview {
  recoveredRevenueCents: number;
  recoveredCarts: number;
  abandonedRevenueCents: number;
  abandonedCarts: number;
  activeAutomations: number;
  trackedRevenueCents: number;
}

export function MerchantHome() {
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    api<{ stores: StoreRow[] }>('/merchant/stores').then((res) => {
      const list = res.data?.stores ?? [];
      setStores(list);
      if (list[0]) {
        api<Overview>(`/merchant/stores/${list[0].id}/overview`).then((o) => setOverview(o.data ?? null));
      }
    });
  }, []);

  if (stores === null) return <Spinner />;

  return (
    <>
      <div className="main__head">
        <h1>Home</h1>
      </div>

      {stores.length === 0 ? (
        <EmptyState
          title="No store connected yet"
          hint="Go to “Connect a store” to register your WooCommerce site and get your license key + signing secret."
        />
      ) : (
        <>
          <div className="grid grid--4">
            <Stat label="Recovered revenue" value={formatCents(overview?.recoveredRevenueCents ?? 0)} sub={`${overview?.recoveredCarts ?? 0} carts recovered`} />
            <Stat label="Abandoned revenue" value={formatCents(overview?.abandonedRevenueCents ?? 0)} sub={`${overview?.abandonedCarts ?? 0} open carts`} />
            <Stat label="Tracked revenue" value={formatCents(overview?.trackedRevenueCents ?? 0)} />
            <Stat label="Active automations" value={overview?.activeAutomations ?? 0} />
          </div>

          <div className="card mt-4">
            <h3>Your stores</h3>
            <table className="table">
              <thead><tr><th>Store</th><th>Domain</th><th>Health</th></tr></thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="muted">{s.domain}</td>
                    <td>{s.connection_health}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
