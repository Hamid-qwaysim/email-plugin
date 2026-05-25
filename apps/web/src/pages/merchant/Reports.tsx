import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { EmptyState, Spinner } from '../../components/ui';

interface Report { id: string; kind: string; period_label: string; status: string; created_at: number }

export function MerchantReports() {
  const { storeId, loading } = useFirstStore();
  const [rows, setRows] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!storeId) return;
    api<{ reports: Report[] }>(`/merchant/stores/${storeId}/reports`).then((r) => setRows(r.data?.reports ?? []));
  }
  useEffect(load, [storeId]);

  async function generate() {
    if (!storeId) return;
    setBusy(true);
    await api(`/merchant/stores/${storeId}/reports/generate`, { method: 'POST', body: {} });
    setBusy(false);
    load();
  }

  if (loading || (storeId && rows === null)) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  return (
    <>
      <div className="main__head">
        <h1>Reports</h1>
        <button className="btn btn--primary" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate monthly report'}</button>
      </div>
      {rows!.length === 0 ? (
        <EmptyState title="No reports yet" hint="Generate a monthly growth report; it's stored and downloadable." />
      ) : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Period</th><th>Type</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {rows!.map((r) => (
                <tr key={r.id}>
                  <td>{r.period_label}</td>
                  <td>{r.kind}</td>
                  <td>{r.status}</td>
                  <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
