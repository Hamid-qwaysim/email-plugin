import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, PageHeader, CardSkeleton, Section, useToast } from '../../components/ui';

interface Popup { id: string; name: string; kind: string; status: string }
const KINDS = ['popup', 'top_bar', 'slide_in', 'exit_intent', 'cart_reminder', 'lead_form'];

export function MerchantPopups() {
  const { storeId, loading } = useFirstStore();
  const toast = useToast();
  const [rows, setRows] = useState<Popup[] | null>(null);
  const [name, setName] = useState('Exit-intent offer');
  const [kind, setKind] = useState('exit_intent');
  const [title, setTitle] = useState('Wait — 10% off!');
  const [bodyText, setBodyText] = useState('Complete your order now and save.');
  const [code, setCode] = useState('SAVE10');
  const [cap, setCap] = useState(1);

  function load() {
    if (!storeId) return;
    api<{ popups: Popup[] }>(`/merchant/stores/${storeId}/popups`).then((r) => setRows(r.data?.popups ?? []));
  }
  useEffect(load, [storeId]);

  async function create() {
    if (!storeId || !name) return;
    const res = await api(`/merchant/stores/${storeId}/popups`, {
      method: 'POST',
      body: { name, kind, status: 'active', content: { title, body: bodyText, code }, design: { color: '#5b54f0' }, frequency: { perSession: cap } },
    });
    if (res.ok) { toast.push('Popup published', 'ok'); load(); } else toast.push('Failed', 'error');
  }
  async function toggle(id: string, status: string) {
    if (!storeId) return;
    await api(`/merchant/stores/${storeId}/popups/${id}/status`, { method: 'PATCH', body: { status } });
    load();
  }

  if (loading || (storeId && rows === null)) return <CardSkeleton rows={5} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  return (
    <>
      <PageHeader title="Popups & On-site" sub="Targeted on-site messages with frequency caps" />
      <div className="grid grid--2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <Section title="New on-site element">
          <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Type</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          </div>
          <div className="field"><label>Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label>Body</label><input className="input" value={bodyText} onChange={(e) => setBodyText(e.target.value)} /></div>
          <div className="field"><label>Coupon code (optional)</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div className="field"><label>Show at most (per session)</label><input className="input" type="number" value={cap} onChange={(e) => setCap(Number(e.target.value))} /></div>
          <button className="btn btn--primary" onClick={create}>Publish</button>
        </Section>
        <Section title="Preview">
          <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 24, minHeight: 200, display: 'grid', placeItems: 'center' }}>
            <div className="card" style={{ maxWidth: 300, textAlign: 'center' }}>
              <h3 style={{ marginTop: 0 }}>{title}</h3>
              <p className="muted">{bodyText}</p>
              {code && <div style={{ border: '2px dashed var(--primary)', borderRadius: 8, padding: 8, fontWeight: 700 }}>{code}</div>}
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Your on-site elements">
          {rows!.length === 0 ? <p className="muted">None yet — create one above.</p> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Type</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows!.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td className="muted">{p.kind}</td>
                    <td><Badge tone={p.status === 'active' ? 'ok' : 'off'}>{p.status}</Badge></td>
                    <td>{p.status === 'active'
                      ? <button className="btn btn--ghost btn--sm" onClick={() => toggle(p.id, 'draft')}>Pause</button>
                      : <button className="btn btn--primary btn--sm" onClick={() => toggle(p.id, 'active')}>Activate</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}
