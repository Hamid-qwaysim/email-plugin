import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, Spinner } from '../../components/ui';

interface Campaign { id: string; name: string; status: string; goal_prompt: string }

export function MerchantCampaigns() {
  const { storeId, loading } = useFirstStore();
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<unknown>(null);

  function load() {
    if (!storeId) return;
    api<{ campaigns: Campaign[] }>(`/merchant/stores/${storeId}/campaigns`).then((r) => setRows(r.data?.campaigns ?? []));
  }
  useEffect(load, [storeId]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!storeId || !goal) return;
    setBusy(true);
    const res = await api<{ campaign: unknown }>(`/merchant/stores/${storeId}/campaigns/generate`, { method: 'POST', body: { goal } });
    setBusy(false);
    setGenerated(res.data?.campaign ?? null);
    setGoal('');
    load();
  }
  async function launch(id: string) {
    if (!storeId) return;
    await api(`/merchant/stores/${storeId}/campaigns/${id}/launch`, { method: 'POST', body: {} });
    load();
  }

  if (loading || (storeId && rows === null)) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  return (
    <>
      <div className="main__head"><h1>Campaigns</h1></div>
      <div className="card" style={{ maxWidth: 720 }}>
        <h3>AI campaign generator</h3>
        <form onSubmit={generate}>
          <div className="field">
            <label>Describe your goal</label>
            <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Create an offer for inactive customers this weekend" required />
          </div>
          <button className="btn btn--primary" disabled={busy}>{busy ? 'Generating…' : 'Generate campaign'}</button>
        </form>
        {generated != null && (
          <pre style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, overflow: 'auto', marginTop: 14, fontSize: 12 }}>
            {JSON.stringify(generated, null, 2)}
          </pre>
        )}
      </div>

      <div className="card mt-4">
        <h3>All campaigns</h3>
        {rows!.length === 0 ? (
          <p className="muted">No campaigns yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Goal</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows!.map((cmp) => (
                <tr key={cmp.id}>
                  <td>{cmp.name}</td>
                  <td className="muted">{cmp.goal_prompt}</td>
                  <td><Badge tone={cmp.status === 'running' ? 'ok' : 'off'}>{cmp.status}</Badge></td>
                  <td>{cmp.status !== 'running' && <button className="btn btn--primary" onClick={() => launch(cmp.id)}>Launch</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
