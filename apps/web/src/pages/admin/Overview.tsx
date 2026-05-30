import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Stat, Spinner } from '../../components/ui';

interface Overview {
  storesConnected: number;
  emailsSent: number;
  licensesByStatus: { status: string; n: number }[];
  subscriptionsByStatus: { status: string; n: number }[];
}

export function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Overview>('/admin/overview').then((res) => {
      if (res.ok) setData(res.data ?? null);
      else setErr(res.error?.message ?? 'Failed to load.');
    });
  }, []);

  if (err) return <div className="card">{err}</div>;
  if (!data) return <Spinner />;

  const active = data.licensesByStatus.find((l) => l.status === 'active')?.n ?? 0;
  const trialing = data.licensesByStatus.find((l) => l.status === 'trialing')?.n ?? 0;

  return (
    <>
      <div className="main__head"><h1>Platform overview</h1></div>
      <div className="grid grid--4">
        <Stat label="Stores connected" value={data.storesConnected} />
        <Stat label="Active licenses" value={active} />
        <Stat label="Trialing" value={trialing} />
        <Stat label="Emails sent" value={data.emailsSent} />
      </div>
      <div className="grid grid--2 mt-4">
        <div className="card">
          <h3>Licenses by status</h3>
          <table className="table">
            <tbody>
              {data.licensesByStatus.map((l) => (
                <tr key={l.status}><td>{l.status}</td><td>{l.n}</td></tr>
              ))}
              {data.licensesByStatus.length === 0 && <tr><td className="muted">No licenses yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Subscriptions by status</h3>
          <table className="table">
            <tbody>
              {data.subscriptionsByStatus.map((s) => (
                <tr key={s.status}><td>{s.status}</td><td>{s.n}</td></tr>
              ))}
              {data.subscriptionsByStatus.length === 0 && <tr><td className="muted">No subscriptions yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
