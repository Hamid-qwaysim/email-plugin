import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { EmptyState, PageHeader, CardSkeleton, Section, useToast } from '../../components/ui';

interface Autopilot {
  enabled: boolean;
  aggressiveness: number; // 1..5
  discountStrategy: 'conservative' | 'balanced' | 'aggressive';
  tone: string;
  approvalMode: 'auto' | 'approval';
  channels: { email: boolean; webPush: boolean; whatsapp: boolean };
}

const DEFAULT: Autopilot = {
  enabled: true, aggressiveness: 3, discountStrategy: 'balanced', tone: 'friendly, helpful',
  approvalMode: 'auto', channels: { email: true, webPush: false, whatsapp: false },
};

export function MerchantAutopilot() {
  const { storeId, loading } = useFirstStore();
  const toast = useToast();
  const [cfg, setCfg] = useState<Autopilot>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    api<{ brand: { autopilot?: Partial<Autopilot> } }>(`/merchant/stores/${storeId}/settings`).then((r) => {
      setCfg({ ...DEFAULT, ...(r.data?.brand?.autopilot ?? {}) });
      setReady(true);
    });
  }, [storeId]);

  async function save() {
    if (!storeId) return;
    const res = await api(`/merchant/stores/${storeId}/settings`, { method: 'PATCH', body: { autopilot: cfg } });
    if (res.ok) toast.push('Autopilot settings saved', 'ok'); else toast.push('Save failed', 'error');
  }

  if (loading || (storeId && !ready)) return <CardSkeleton rows={5} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  return (
    <>
      <PageHeader title="AI Autopilot" sub="Tune how aggressively the AI markets on your behalf" actions={<button className="btn btn--primary" onClick={save}>Save</button>} />

      <Section title="Master control">
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
          <span><strong>AI Autopilot {cfg.enabled ? 'ON' : 'OFF'}</strong> — when on, flows run automatically within your guardrails.</span>
        </label>
      </Section>

      <div className="grid grid--2 mt-4">
        <Section title="Aggressiveness">
          <input type="range" min={1} max={5} value={cfg.aggressiveness} style={{ width: '100%' }} onChange={(e) => setCfg({ ...cfg, aggressiveness: Number(e.target.value) })} />
          <div className="row between muted" style={{ fontSize: 12 }}><span>Gentle</span><span>Level {cfg.aggressiveness}</span><span>Aggressive</span></div>
        </Section>
        <Section title="Discount strategy">
          <div className="tabs">
            {(['conservative', 'balanced', 'aggressive'] as const).map((s) => (
              <button key={s} className={cfg.discountStrategy === s ? 'active' : ''} onClick={() => setCfg({ ...cfg, discountStrategy: s })}>{s}</button>
            ))}
          </div>
          <p className="muted mt-2" style={{ fontSize: 13 }}>Bounded by your coupon profit guard regardless of this setting.</p>
        </Section>
      </div>

      <div className="grid grid--2 mt-4">
        <Section title="Brand tone">
          <input className="input" value={cfg.tone} onChange={(e) => setCfg({ ...cfg, tone: e.target.value })} />
        </Section>
        <Section title="Approval mode">
          <div className="tabs">
            <button className={cfg.approvalMode === 'auto' ? 'active' : ''} onClick={() => setCfg({ ...cfg, approvalMode: 'auto' })}>Fully automatic</button>
            <button className={cfg.approvalMode === 'approval' ? 'active' : ''} onClick={() => setCfg({ ...cfg, approvalMode: 'approval' })}>Require approval</button>
          </div>
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Allowed channels (no SMS)">
          {(['email', 'webPush', 'whatsapp'] as const).map((ch) => (
            <label className="row" key={ch} style={{ gap: 10, padding: '6px 0' }}>
              <input type="checkbox" checked={cfg.channels[ch]} onChange={(e) => setCfg({ ...cfg, channels: { ...cfg.channels, [ch]: e.target.checked } })} />
              <span style={{ textTransform: 'capitalize' }}>{ch === 'webPush' ? 'Web push' : ch}</span>
              {ch === 'whatsapp' && <span className="muted" style={{ fontSize: 12 }}>(requires provider credentials)</span>}
            </label>
          ))}
        </Section>
      </div>
    </>
  );
}
