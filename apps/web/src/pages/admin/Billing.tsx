import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, PageHeader, CardSkeleton, Section } from '../../components/ui';

interface Sub { id: string; org_id: string; plan_id: string; status: string; provider: string | null }
interface Hook { id: string; provider: string; event_type: string | null; signature_ok: number; processed: number; created_at: number }

export function AdminBilling() {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [hooks, setHooks] = useState<Hook[]>([]);
  useEffect(() => {
    api<{ subscriptions: Sub[]; webhooks: Hook[] }>('/admin/billing').then((r) => { setSubs(r.data?.subscriptions ?? []); setHooks(r.data?.webhooks ?? []); });
  }, []);
  if (subs === null) return <CardSkeleton rows={6} />;
  return (
    <>
      <PageHeader title="Billing" sub="Subscriptions and inbound webhooks" />
      <Section title="Subscriptions">
        {subs.length === 0 ? <p className="muted">No subscriptions yet.</p> : (
          <table className="table">
            <thead><tr><th>Org</th><th>Plan</th><th>Status</th><th>Provider</th></tr></thead>
            <tbody>{subs.map((s) => <tr key={s.id}><td className="muted">{s.org_id}</td><td>{s.plan_id}</td><td><Badge tone={s.status === 'active' ? 'ok' : 'off'}>{s.status}</Badge></td><td>{s.provider ?? '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Section>
      <div className="mt-4">
        <Section title="Recent billing webhooks">
          {hooks.length === 0 ? <p className="muted">No webhooks received.</p> : (
            <table className="table">
              <thead><tr><th>When</th><th>Event</th><th>Signature</th><th>Processed</th></tr></thead>
              <tbody>{hooks.map((h) => <tr key={h.id}><td className="muted">{new Date(h.created_at).toLocaleString()}</td><td>{h.event_type ?? '—'}</td><td><Badge tone={h.signature_ok ? 'ok' : 'warn'}>{h.signature_ok ? 'valid' : 'invalid'}</Badge></td><td>{h.processed ? 'yes' : 'no'}</td></tr>)}</tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}
