import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { EmptyState, Spinner } from '../../components/ui';

interface Segment { id: string; name: string; kind: string; member_count: number }

export function MerchantSegments() {
  const { storeId, loading } = useFirstStore();
  const [rows, setRows] = useState<Segment[] | null>(null);
  const [name, setName] = useState('');

  function load() {
    if (!storeId) return;
    api<{ segments: Segment[] }>(`/merchant/stores/${storeId}/segments`).then((r) => setRows(r.data?.segments ?? []));
  }
  useEffect(load, [storeId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!storeId || !name) return;
    await api(`/merchant/stores/${storeId}/segments`, { method: 'POST', body: { name, rules: {} } });
    setName('');
    load();
  }

  if (loading || (storeId && rows === null)) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  const auto = ['high_intent', 'cart_abandoner', 'vip', 'inactive', 'discount_hunter', 'repeat_buyer'];

  return (
    <>
      <div className="main__head"><h1>Segments</h1></div>
      <div className="card">
        <h3>Automatic segments</h3>
        <ul className="arre-pill-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0 }}>
          {auto.map((s) => <li key={s} style={{ background: 'var(--primary-50)', color: 'var(--primary-600)', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>{s}</li>)}
        </ul>
        <p className="muted mt-2">Visitors are auto-classified into 20 segments based on behavior and purchase history.</p>
      </div>

      <div className="card mt-4" style={{ maxWidth: 560 }}>
        <h3>Create a custom segment</h3>
        <form onSubmit={create} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High AOV repeat buyers" required />
          <button className="btn btn--primary">Add</button>
        </form>
      </div>

      <div className="card mt-4">
        <h3>Your segments</h3>
        {rows!.length === 0 ? (
          <p className="muted">No custom segments yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Members</th></tr></thead>
            <tbody>{rows!.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.kind}</td><td>{s.member_count}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
