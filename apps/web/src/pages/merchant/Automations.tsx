import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, Spinner } from '../../components/ui';

interface Automation { id: string; name: string; mode: string; status: string; trigger: string }

const TRIGGERS = ['checkout_abandoned', 'add_to_cart', 'purchase_completed', 'customer_inactive', 'back_in_stock', 'price_dropped'];

export function MerchantAutomations() {
  const { storeId, loading } = useFirstStore();
  const [rows, setRows] = useState<Automation[] | null>(null);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState(TRIGGERS[0]);

  function load() {
    if (!storeId) return;
    api<{ automations: Automation[] }>(`/merchant/stores/${storeId}/automations`).then((r) => setRows(r.data?.automations ?? []));
  }
  useEffect(load, [storeId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!storeId || !name) return;
    await api(`/merchant/stores/${storeId}/automations`, { method: 'POST', body: { name, trigger, mode: 'autopilot' } });
    setName('');
    load();
  }
  async function setStatus(id: string, status: string) {
    if (!storeId) return;
    await api(`/merchant/stores/${storeId}/automations/${id}/status`, { method: 'PATCH', body: { status } });
    load();
  }

  if (loading || (storeId && rows === null)) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  return (
    <>
      <div className="main__head"><h1>Automations</h1></div>
      <div className="card" style={{ maxWidth: 640 }}>
        <h3>New automation</h3>
        <form onSubmit={create} className="grid grid--3" style={{ alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Win-back flow" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Trigger</label>
            <select className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn btn--primary">Create</button>
        </form>
      </div>

      <div className="card mt-4">
        <h3>Your flows</h3>
        {rows!.length === 0 ? (
          <p className="muted">No automations yet. Create one above or apply a store-type template.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Trigger</th><th>Mode</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows!.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="muted">{a.trigger}</td>
                  <td>{a.mode}</td>
                  <td><Badge tone={a.status === 'active' ? 'ok' : 'off'}>{a.status}</Badge></td>
                  <td>
                    {a.status === 'active'
                      ? <button className="btn btn--ghost" onClick={() => setStatus(a.id, 'paused')}>Pause</button>
                      : <button className="btn btn--primary" onClick={() => setStatus(a.id, 'active')}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
