import { useEffect, useState, type FormEvent } from 'react';
import { api, formatCents } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { EmptyState, Spinner, Stat } from '../../components/ui';

interface Client {
  id: string;
  name: string;
  recoveredRevenueCents: number;
  stores: { id: string; name: string; domain: string }[];
}

export function MerchantAgency() {
  const { user } = useAuth();
  const isAgency = user && ['agency_owner', 'agency_member'].includes(user.role);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [overview, setOverview] = useState<{ clientStores: number; recoveredRevenueCents: number } | null>(null);
  const [name, setName] = useState('');

  function load() {
    api<{ clients: Client[] }>('/agency/clients').then((r) => setClients(r.data?.clients ?? []));
    api<{ clientStores: number; recoveredRevenueCents: number }>('/agency/overview').then((r) => setOverview(r.data ?? null));
  }
  useEffect(() => {
    if (isAgency) load();
  }, [isAgency]);

  async function addClient(e: FormEvent) {
    e.preventDefault();
    if (!name) return;
    await api('/agency/clients', { method: 'POST', body: { name } });
    setName('');
    load();
  }

  if (!isAgency) return <EmptyState title="Agency features" hint="This area is available to agency accounts. Upgrade to the Agency plan to manage multiple client stores with white-label reporting." />;
  if (clients === null) return <Spinner />;

  return (
    <>
      <div className="main__head"><h1>Agency</h1></div>
      <div className="grid grid--2">
        <Stat label="Client stores" value={overview?.clientStores ?? 0} />
        <Stat label="Recovered for clients" value={formatCents(overview?.recoveredRevenueCents ?? 0)} />
      </div>

      <div className="card mt-4" style={{ maxWidth: 560 }}>
        <h3>Add a client</h3>
        <form onSubmit={addClient} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client business name" required />
          <button className="btn btn--primary">Add client</button>
        </form>
      </div>

      <div className="card mt-4">
        <h3>Clients</h3>
        {clients.length === 0 ? (
          <p className="muted">No clients yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Client</th><th>Stores</th><th>Recovered</th></tr></thead>
            <tbody>
              {clients.map((cl) => (
                <tr key={cl.id}>
                  <td>{cl.name}</td>
                  <td className="muted">{cl.stores.map((s) => s.domain).join(', ') || '—'}</td>
                  <td>{formatCents(cl.recoveredRevenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
