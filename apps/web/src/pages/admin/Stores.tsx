import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, Spinner } from '../../components/ui';

interface Store {
  id: string;
  domain: string;
  plugin_version: string | null;
  wp_version: string | null;
  woo_version: string | null;
  hpos_enabled: number | null;
  connection_health: string;
  last_seen_at: number | null;
}

export function AdminStores() {
  const [rows, setRows] = useState<Store[] | null>(null);
  useEffect(() => {
    api<{ stores: Store[] }>('/admin/stores').then((r) => setRows(r.data?.stores ?? []));
  }, []);
  if (rows === null) return <Spinner />;

  return (
    <>
      <div className="main__head"><h1>Connected stores</h1></div>
      <div className="card">
        {rows.length === 0 ? (
          <p className="muted">No stores connected yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Domain</th><th>Plugin</th><th>WP</th><th>Woo</th><th>HPOS</th><th>Health</th><th>Last seen</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.domain}</td>
                  <td>{s.plugin_version ?? '—'}</td>
                  <td>{s.wp_version ?? '—'}</td>
                  <td>{s.woo_version ?? '—'}</td>
                  <td>{s.hpos_enabled ? 'Yes' : 'No'}</td>
                  <td><Badge tone={s.connection_health === 'healthy' ? 'ok' : 'off'}>{s.connection_health}</Badge></td>
                  <td className="muted">{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
