import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, PageHeader, CardSkeleton, Section, useToast } from '../../components/ui';

interface Automation { id: string; name: string; mode: string; status: string; trigger: string }

const TRIGGERS = ['checkout_abandoned', 'add_to_cart', 'product_viewed_multiple', 'purchase_completed', 'customer_inactive', 'back_in_stock', 'price_dropped'];
const ACTIONS = ['send_email', 'send_web_push', 'generate_coupon', 'show_popup', 'add_to_segment', 'create_admin_alert'];
const COND_FIELDS = ['intentScore', 'ordersCount', 'aovCents', 'daysSinceLastSeen', 'couponUses'];
const COND_OPS: [string, string][] = [['gte', '≥'], ['gt', '>'], ['lte', '≤'], ['lt', '<'], ['eq', '=']];

type Step =
  | { kind: 'condition'; field: string; op: string; value: number }
  | { kind: 'delay'; minutes: number }
  | { kind: 'action'; action: string };

/** Compile the linear step list into a valid engine Flow graph. */
function compileFlow(steps: Step[]) {
  const nodes: Record<string, unknown> = {};
  const idOf = (i: number) => (i >= steps.length ? 'end' : `s${i}`);
  nodes['trigger'] = { id: 'trigger', kind: 'trigger', next: [idOf(0)] };
  steps.forEach((step, i) => {
    const id = `s${i}`;
    const nextId = idOf(i + 1);
    if (step.kind === 'condition') {
      nodes[id] = { id, kind: 'condition', rules: { all: [{ field: step.field, op: step.op, value: step.value }] }, next: [nextId, 'end'] };
    } else if (step.kind === 'delay') {
      nodes[id] = { id, kind: 'delay', delayMinutes: step.minutes, next: [nextId] };
    } else {
      nodes[id] = { id, kind: 'action', action: { type: step.action }, next: [nextId] };
    }
  });
  nodes['end'] = { id: 'end', kind: 'action', action: { type: 'stop' } };
  return { startId: 'trigger', nodes };
}

const STEP_ICON: Record<string, string> = { condition: '◆', delay: '⏱', action: '⚡' };

export function MerchantAutomations() {
  const { storeId, loading } = useFirstStore();
  const toast = useToast();
  const [rows, setRows] = useState<Automation[] | null>(null);
  const [name, setName] = useState('Win-back flow');
  const [trigger, setTrigger] = useState<string>(TRIGGERS[0]!);
  const [steps, setSteps] = useState<Step[]>([
    { kind: 'delay', minutes: 60 },
    { kind: 'action', action: 'send_email' },
    { kind: 'condition', field: 'intentScore', op: 'gte', value: 60 },
    { kind: 'action', action: 'generate_coupon' },
  ]);

  function load() {
    if (!storeId) return;
    api<{ automations: Automation[] }>(`/merchant/stores/${storeId}/automations`).then((r) => setRows(r.data?.automations ?? []));
  }
  useEffect(load, [storeId]);

  function patch(i: number, p: Partial<Step>) {
    setSteps((s) => s.map((st, idx) => (idx === i ? ({ ...st, ...p } as Step) : st)));
  }
  function addStep(kind: Step['kind']) {
    const def: Step = kind === 'delay' ? { kind: 'delay', minutes: 1440 }
      : kind === 'condition' ? { kind: 'condition', field: 'intentScore', op: 'gte', value: 60 }
      : { kind: 'action', action: 'send_email' };
    setSteps((s) => [...s, def]);
  }
  function removeStep(i: number) { setSteps((s) => s.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    setSteps((s) => { const j = i + dir; if (j < 0 || j >= s.length) return s; const c = [...s]; [c[i], c[j]] = [c[j]!, c[i]!]; return c; });
  }

  async function save() {
    if (!storeId || !name) return;
    const res = await api(`/merchant/stores/${storeId}/automations`, { method: 'POST', body: { name, trigger, mode: 'manual', flow: compileFlow(steps) } });
    if (res.ok) { toast.push('Automation created', 'ok'); load(); } else toast.push(res.error?.message ?? 'Save failed', 'error');
  }
  async function setStatus(id: string, status: string) {
    if (!storeId) return;
    await api(`/merchant/stores/${storeId}/automations/${id}/status`, { method: 'PATCH', body: { status } });
    load();
  }

  if (loading || (storeId && rows === null)) return <CardSkeleton rows={5} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  return (
    <>
      <PageHeader title="Automations" sub="Visual flow builder · Trigger → Condition → Delay → Action" actions={<button className="btn btn--primary" onClick={save}>Save flow</button>} />

      <div className="card card--pad-lg">
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div className="field" style={{ margin: 0, flex: '2 1 240px' }}>
            <label>Flow name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <label>Trigger</label>
            <select className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Visual vertical flow */}
        <FlowNode color="#5b54f0" badge="TRIGGER" title={trigger} />
        {steps.map((step, i) => (
          <div key={i}>
            <Connector />
            <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)', padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>{STEP_ICON[step.kind]} {step.kind.toUpperCase()}</strong>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === steps.length - 1}>↓</button>
                  <button className="btn btn--danger btn--sm" onClick={() => removeStep(i)}>✕</button>
                </div>
              </div>
              {step.kind === 'delay' && (
                <div className="row" style={{ gap: 8 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Wait</span>
                  <input className="input" type="number" style={{ width: 120 }} value={step.minutes} onChange={(e) => patch(i, { minutes: Number(e.target.value) })} />
                  <span className="muted" style={{ fontSize: 13 }}>minutes ({(step.minutes / 60).toFixed(1)}h)</span>
                </div>
              )}
              {step.kind === 'action' && (
                <select className="input" style={{ maxWidth: 280 }} value={step.action} onChange={(e) => patch(i, { action: e.target.value })}>
                  {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {step.kind === 'condition' && (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Continue only if</span>
                  <select className="input" style={{ flex: '1 1 160px' }} value={step.field} onChange={(e) => patch(i, { field: e.target.value })}>
                    {COND_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select className="input" style={{ flex: '0 0 80px' }} value={step.op} onChange={(e) => patch(i, { op: e.target.value })}>
                    {COND_OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input className="input" type="number" style={{ flex: '0 0 100px' }} value={step.value} onChange={(e) => patch(i, { value: Number(e.target.value) })} />
                  <span className="muted" style={{ fontSize: 12 }}>(else stop)</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <Connector />
        <FlowNode color="#9aa1b2" badge="END" title="Stop flow" />

        <div className="row mt-4" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>Add step:</span>
          <button className="btn btn--ghost btn--sm" onClick={() => addStep('condition')}>◆ Condition</button>
          <button className="btn btn--ghost btn--sm" onClick={() => addStep('delay')}>⏱ Delay</button>
          <button className="btn btn--ghost btn--sm" onClick={() => addStep('action')}>⚡ Action</button>
        </div>
      </div>

      <div className="mt-4">
        <Section title="Your flows">
          {rows!.length === 0 ? (
            <p className="muted">No automations yet — build one above.</p>
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
                    <td>{a.status === 'active'
                      ? <button className="btn btn--ghost btn--sm" onClick={() => setStatus(a.id, 'paused')}>Pause</button>
                      : <button className="btn btn--primary btn--sm" onClick={() => setStatus(a.id, 'active')}>Activate</button>}</td>
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

function FlowNode({ color, badge, title }: { color: string; badge: string; title: string }) {
  return (
    <div className="row" style={{ gap: 12, padding: '12px 14px', border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`, borderRadius: 10, background: '#fff' }}>
      <span className="badge" style={{ background: `${color}1a`, color }}>{badge}</span>
      <strong style={{ fontSize: 14 }}>{title}</strong>
    </div>
  );
}
function Connector() {
  return <div style={{ width: 2, height: 18, background: 'var(--border)', margin: '2px 0 2px 22px' }} />;
}
