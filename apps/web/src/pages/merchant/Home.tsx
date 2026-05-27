import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatCents } from '../../lib/api';
import { PageHeader, Stat, EmptyState, StatGridSkeleton, Section } from '../../components/ui';
import { BarRow } from '../../components/charts';

interface StoreRow { id: string; name: string; domain: string; connection_health: string; last_seen_at: number | null }
interface Overview {
  recoveredRevenueCents: number; recoveredCarts: number;
  abandonedRevenueCents: number; abandonedCarts: number;
  activeAutomations: number; trackedRevenueCents: number;
}
interface License { status: string; plan_id: string }

// Annual subscription cost for the ROI hero (real plan price would come from billing).
const PLAN_COST_CENTS: Record<string, number> = { free_test: 0, starter: 9700, growth: 19700, pro: 24900, agency: 0 };

export function MerchantHome() {
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [license, setLicense] = useState<License | null>(null);

  useEffect(() => {
    api<{ stores: StoreRow[] }>('/merchant/stores').then((res) => {
      const list = res.data?.stores ?? [];
      setStores(list);
      if (list[0]) api<Overview>(`/merchant/stores/${list[0].id}/overview`).then((o) => setOverview(o.data ?? null));
    });
    api<{ license: License }>('/merchant/license').then((r) => setLicense(r.data?.license ?? null));
  }, []);

  if (stores === null) return <StatGridSkeleton />;

  if (stores.length === 0) {
    return (
      <>
        <PageHeader title="Welcome 👋" sub="Let's get your store recovering revenue." />
        <EmptyState
          title="Connect your first store"
          hint="Register your WooCommerce store to get a license key and signing secret for the plugin."
          icon="🔌"
          action={<Link to="/app/connect" className="btn btn--primary">Connect a store</Link>}
        />
      </>
    );
  }

  const planCost = license ? PLAN_COST_CENTS[license.plan_id] ?? 0 : 0;
  const recovered = overview?.recoveredRevenueCents ?? 0;
  const roi = planCost > 0 ? (recovered / planCost).toFixed(1) : '∞';

  // Onboarding steps derived from real state.
  const steps = [
    { label: 'Connect your store', done: true },
    { label: 'Tracking is live', done: !!stores[0]?.last_seen_at },
    { label: 'Activate a recovery automation', done: (overview?.activeAutomations ?? 0) > 0 },
    { label: 'First recovered cart', done: (overview?.recoveredCarts ?? 0) > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <>
      <PageHeader title="Home" sub={stores[0]?.domain} />

      <div className="grid grid--2" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="hero-metric">
          <div className="label">{planCost > 0 ? `Your plan is ${formatCents(planCost)}/yr — so far we recovered` : 'Recovered so far'}</div>
          <div className="value">{formatCents(recovered)}</div>
          <div className="sub">{recovered > 0 && planCost > 0 ? `That's ${roi}× your annual subscription.` : 'Recovery starts as soon as carts are abandoned.'}</div>
        </div>
        <Section title="Setup progress">
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>{doneCount} of {steps.length} complete</span>
            <strong>{pct}%</strong>
          </div>
          <div className="progress"><div className="progress__bar" style={{ width: `${pct}%` }} /></div>
          <div className="mt-2">
            {steps.map((s) => (
              <div className="checklist__item" key={s.label}>
                <span className={`checklist__check ${s.done ? 'checklist__check--done' : 'checklist__check--todo'}`}>{s.done ? '✓' : ''}</span>
                <span style={{ color: s.done ? 'var(--text)' : 'var(--muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid--4 mt-4">
        <Stat label="Recovered revenue" value={formatCents(recovered)} sub={`${overview?.recoveredCarts ?? 0} carts recovered`} icon="💰" />
        <Stat label="Abandoned revenue" value={formatCents(overview?.abandonedRevenueCents ?? 0)} sub={`${overview?.abandonedCarts ?? 0} open carts`} icon="🛒" />
        <Stat label="Tracked revenue" value={formatCents(overview?.trackedRevenueCents ?? 0)} icon="📈" />
        <Stat label="Active automations" value={overview?.activeAutomations ?? 0} icon="⚡" />
      </div>

      <div className="grid grid--2 mt-4">
        <Section title="Recovery snapshot">
          <BarRow label="Recovered carts" value={overview?.recoveredCarts ?? 0} max={Math.max(1, (overview?.recoveredCarts ?? 0) + (overview?.abandonedCarts ?? 0))} />
          <BarRow label="Open abandoned carts" value={overview?.abandonedCarts ?? 0} max={Math.max(1, (overview?.recoveredCarts ?? 0) + (overview?.abandonedCarts ?? 0))} />
        </Section>
        <Section title="Quick actions">
          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <Link to="/app/automations" className="btn btn--ghost">Manage automations</Link>
            <Link to="/app/campaigns" className="btn btn--ghost">New AI campaign</Link>
            <Link to="/app/store-doctor" className="btn btn--ghost">Run Store Doctor</Link>
            <Link to="/app/reports" className="btn btn--ghost">Monthly report</Link>
          </div>
        </Section>
      </div>
    </>
  );
}
