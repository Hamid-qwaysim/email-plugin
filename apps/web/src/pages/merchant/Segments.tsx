import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, PageHeader, CardSkeleton, Section, useToast } from '../../components/ui';

interface Segment { id: string; name: string; kind: string; member_count: number }

type FieldType = 'number' | 'bool';
const FIELDS: { key: string; label: string; type: FieldType }[] = [
  { key: 'intentScore', label: 'Intent score', type: 'number' },
  { key: 'sessions', label: 'Sessions', type: 'number' },
  { key: 'ordersCount', label: 'Orders count', type: 'number' },
  { key: 'aovCents', label: 'Avg order value (¢)', type: 'number' },
  { key: 'ltvCents', label: 'Lifetime value (¢)', type: 'number' },
  { key: 'daysSinceLastSeen', label: 'Days since last seen', type: 'number' },
  { key: 'couponUses', label: 'Coupon uses', type: 'number' },
  { key: 'hasAbandonedCart', label: 'Has abandoned cart', type: 'bool' },
  { key: 'hasAbandonedCheckout', label: 'Has abandoned checkout', type: 'bool' },
  { key: 'emailEngaged', label: 'Email engaged', type: 'bool' },
  { key: 'webPushSubscribed', label: 'Web push subscriber', type: 'bool' },
  { key: 'whatsappReady', label: 'WhatsApp ready', type: 'bool' },
];
const NUM_OPS: [string, string][] = [['gte', '≥'], ['gt', '>'], ['lte', '≤'], ['lt', '<'], ['eq', '='], ['neq', '≠']];
const BOOL_OPS: [string, string][] = [['eq', 'is'], ['neq', 'is not']];

interface Cond { field: string; op: string; value: number | boolean }

const fieldType = (key: string): FieldType => FIELDS.find((f) => f.key === key)?.type ?? 'number';

const PERSONAS: { name: string; signals: Record<string, number | boolean> }[] = [
  { name: 'VIP buyer', signals: { intentScore: 90, sessions: 8, ordersCount: 4, aovCents: 22000, ltvCents: 90000, hasAbandonedCart: false, hasAbandonedCheckout: false, daysSinceLastSeen: 3, emailEngaged: true, couponUses: 1, webPushSubscribed: true, whatsappReady: false } },
  { name: 'New visitor', signals: { intentScore: 20, sessions: 1, ordersCount: 0, aovCents: 0, ltvCents: 0, hasAbandonedCart: false, hasAbandonedCheckout: false, daysSinceLastSeen: 0, emailEngaged: false, couponUses: 0, webPushSubscribed: false, whatsappReady: false } },
  { name: 'Discount hunter', signals: { intentScore: 50, sessions: 4, ordersCount: 2, aovCents: 3000, ltvCents: 6000, hasAbandonedCart: true, hasAbandonedCheckout: true, daysSinceLastSeen: 10, emailEngaged: true, couponUses: 7, webPushSubscribed: false, whatsappReady: false } },
];

export function MerchantSegments() {
  const { storeId, loading } = useFirstStore();
  const toast = useToast();
  const [rows, setRows] = useState<Segment[] | null>(null);

  const [name, setName] = useState('');
  const [match, setMatch] = useState<'all' | 'any'>('all');
  const [conds, setConds] = useState<Cond[]>([{ field: 'intentScore', op: 'gte', value: 60 }]);
  const [tests, setTests] = useState<Record<string, boolean> | null>(null);

  function load() {
    if (!storeId) return;
    api<{ segments: Segment[] }>(`/merchant/stores/${storeId}/segments`).then((r) => setRows(r.data?.segments ?? []));
  }
  useEffect(load, [storeId]);

  function setCond(i: number, patch: Partial<Cond>) {
    setConds((c) => c.map((row, idx) => {
      if (idx !== i) return row;
      const next = { ...row, ...patch };
      // Reset op/value when the field type changes.
      if (patch.field) {
        const t = fieldType(patch.field);
        next.op = t === 'bool' ? 'eq' : 'gte';
        next.value = t === 'bool' ? true : 0;
      }
      return next;
    }));
  }
  function addCond() { setConds((c) => [...c, { field: 'ordersCount', op: 'gte', value: 1 }]); }
  function removeCond(i: number) { setConds((c) => c.filter((_, idx) => idx !== i)); }

  function buildRules() { return { [match]: conds }; }

  async function runTest() {
    if (!storeId) return;
    const results: Record<string, boolean> = {};
    await Promise.all(PERSONAS.map(async (p) => {
      const res = await api<{ matches: boolean }>(`/merchant/stores/${storeId}/segments/preview`, { method: 'POST', body: { rules: buildRules(), sample: p.signals } });
      results[p.name] = !!res.data?.matches;
    }));
    setTests(results);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!storeId || !name) return;
    const res = await api(`/merchant/stores/${storeId}/segments`, { method: 'POST', body: { name, rules: buildRules() } });
    if (res.ok) { toast.push('Segment saved', 'ok'); setName(''); setTests(null); load(); }
    else toast.push(res.error?.message ?? 'Save failed', 'error');
  }

  if (loading || (storeId && rows === null)) return <CardSkeleton rows={5} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  const auto = ['high_intent', 'cart_abandoner', 'vip', 'inactive', 'discount_hunter', 'repeat_buyer', 'likely_to_buy_7d', 'coupon_abuse_risk'];

  return (
    <>
      <PageHeader title="Segments" sub="Auto-classification + a visual rule builder" />

      <Section title="Automatic segments">
        <ul className="pill-list">{auto.map((s) => <li key={s} className="pill">{s}</li>)}</ul>
        <p className="muted mt-2" style={{ fontSize: 13 }}>Visitors are auto-classified into 20 segments from behavior and purchase history.</p>
      </Section>

      <div className="card mt-4">
        <div className="card__head">
          <h3>Build a custom segment</h3>
          <div className="tabs">
            <button className={match === 'all' ? 'active' : ''} onClick={() => setMatch('all')}>Match ALL</button>
            <button className={match === 'any' ? 'active' : ''} onClick={() => setMatch('any')}>Match ANY</button>
          </div>
        </div>

        {conds.map((cond, i) => {
          const t = fieldType(cond.field);
          const ops = t === 'bool' ? BOOL_OPS : NUM_OPS;
          return (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <select className="input" style={{ flex: '2 1 180px' }} value={cond.field} onChange={(e) => setCond(i, { field: e.target.value })}>
                {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select className="input" style={{ flex: '0 0 90px' }} value={cond.op} onChange={(e) => setCond(i, { op: e.target.value })}>
                {ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {t === 'bool' ? (
                <select className="input" style={{ flex: '1 1 110px' }} value={String(cond.value)} onChange={(e) => setCond(i, { value: e.target.value === 'true' })}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input className="input" type="number" style={{ flex: '1 1 110px' }} value={Number(cond.value)} onChange={(e) => setCond(i, { value: Number(e.target.value) })} />
              )}
              <button className="btn btn--ghost btn--sm" onClick={() => removeCond(i)} disabled={conds.length === 1}>✕</button>
            </div>
          );
        })}
        <button className="btn btn--ghost btn--sm mt-1" onClick={addCond}>+ Add condition</button>

        <div className="mt-4 row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn--ghost" onClick={runTest}>Test against sample profiles</button>
          {tests && PERSONAS.map((p) => (
            <Badge key={p.name} tone={tests[p.name] ? 'ok' : 'off'}>{p.name}: {tests[p.name] ? 'matches' : 'no'}</Badge>
          ))}
        </div>

        <form onSubmit={save} className="row mt-4" style={{ gap: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name (e.g. High-intent VIPs)" required />
          <button className="btn btn--primary">Save segment</button>
        </form>
      </div>

      <div className="mt-4">
        <Section title="Your custom segments">
          {rows!.length === 0 ? (
            <p className="muted">No custom segments yet — build one above.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Name</th><th>Type</th><th>Members</th></tr></thead>
              <tbody>{rows!.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.kind}</td><td>{s.member_count}</td></tr>)}</tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}
