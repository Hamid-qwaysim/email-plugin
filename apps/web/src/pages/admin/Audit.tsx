import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Spinner } from '../../components/ui';

interface Action { id: string; admin_id: string; action: string; target: string; reason: string | null; created_at: number }

export function AdminAudit() {
  const [rows, setRows] = useState<Action[] | null>(null);
  useEffect(() => {
    api<{ actions: Action[] }>('/admin/audit').then((r) => setRows(r.data?.actions ?? []));
  }, []);
  if (rows === null) return <Spinner />;

  return (
    <>
      <div className="main__head"><h1>Admin audit log</h1></div>
      <div className="card">
        {rows.length === 0 ? (
          <p className="muted">No admin actions recorded yet.</p>
        ) : (
          <table className="table">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="muted">{a.admin_id}</td>
                  <td>{a.action}</td>
                  <td className="muted">{a.target}</td>
                  <td>{a.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
