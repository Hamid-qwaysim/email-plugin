import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, PageHeader, CardSkeleton, Section } from '../../components/ui';

interface Merchant { id: string; name: string; type: string; owner_email: string | null; license_status: string | null; plan_id: string | null }

export function AdminMerchants() {
  const [rows, setRows] = useState<Merchant[] | null>(null);
  useEffect(() => { api<{ merchants: Merchant[] }>('/admin/merchants').then((r) => setRows(r.data?.merchants ?? [])); }, []);
  if (rows === null) return <CardSkeleton rows={6} />;
  return (
    <>
      <PageHeader title="Merchants" sub={`${rows.length} organizations`} />
      <Section title="All organizations">
        {rows.length === 0 ? <p className="muted">No merchants yet.</p> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Owner</th><th>Type</th><th>Plan</th><th>License</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="muted">{m.owner_email ?? '—'}</td>
                  <td>{m.type}</td>
                  <td>{m.plan_id ?? '—'}</td>
                  <td>{m.license_status ? <Badge tone={['active', 'trialing'].includes(m.license_status) ? 'ok' : 'off'}>{m.license_status}</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
