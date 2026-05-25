import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FEATURES, FEATURE_IDS, PLANS, PLAN_IDS } from '@arre/shared';
import { formatCents } from '../lib/api';

export function Landing() {
  const [cartValue, setCartValue] = useState(50);
  const [monthlyVisitors, setMonthlyVisitors] = useState(10000);
  // Simple illustrative estimate: ~3% abandoned-cart conversion uplift.
  const recovered = Math.round(monthlyVisitors * 0.012 * cartValue);

  const headlineFeatures = FEATURE_IDS.slice(0, 9).map((id) => FEATURES[id]);

  return (
    <div>
      <header className="container">
        <nav className="nav">
          <div className="nav__brand">⚡ AI Revenue Recovery</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="btn btn--primary">Start free</Link>
          </div>
        </nav>
      </header>

      <section className="hero container">
        <h1>Recover lost sales with an AI marketing team inside your store</h1>
        <p>
          AI Revenue Recovery Engine recovers abandoned carts, generates smart coupons, and automates
          email marketing for WooCommerce — install once, and it works on autopilot.
        </p>
        <div className="hero__cta">
          <Link to="/register" className="btn btn--primary">Start free trial</Link>
          <a href="#calculator" className="btn btn--ghost">Calculate lost revenue</a>
        </div>
      </section>

      <section className="section container" id="calculator">
        <h2>How much revenue are you losing?</h2>
        <p className="lead">Most stores lose 70% of carts. See what recovery could be worth.</p>
        <div className="card grid grid--3" style={{ alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Monthly visitors</label>
            <input className="input" type="number" value={monthlyVisitors}
              onChange={(e) => setMonthlyVisitors(Number(e.target.value) || 0)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Average cart value ($)</label>
            <input className="input" type="number" value={cartValue}
              onChange={(e) => setCartValue(Number(e.target.value) || 0)} />
          </div>
          <div className="stat">
            <div className="stat__label">Est. monthly recovery</div>
            <div className="stat__value">{formatCents(recovered * 100)}</div>
            <div className="stat__sub">Illustrative estimate</div>
          </div>
        </div>
      </section>

      <section className="section container" id="features">
        <h2>Everything your store needs to grow</h2>
        <p className="lead">25 AI-powered features across tracking, recovery, coupons, and automation.</p>
        <div className="grid grid--3">
          {headlineFeatures.map((f) => (
            <div key={f.id} className="card feature">
              <h4>{f.name}</h4>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
        <p className="center mt-4 muted">…and {FEATURE_IDS.length - 9} more, including Store Doctor, A/B testing, and white-label agency tools.</p>
      </section>

      <section className="section container" id="pricing">
        <h2>Simple, scalable pricing</h2>
        <p className="lead">Start free. Upgrade as you recover more revenue.</p>
        <div className="grid grid--4">
          {PLAN_IDS.filter((p) => p !== 'free_test').map((id) => {
            const plan = PLANS[id];
            return (
              <div key={id} className="card price-card">
                <h4>{plan.name}</h4>
                <div className="amount">
                  {formatCents(plan.priceCents)}<span>/mo</span>
                </div>
                <p className="muted" style={{ minHeight: 48 }}>{plan.marketingBlurb}</p>
                <p className="muted" style={{ fontSize: 13 }}>{plan.entitlements.length} features included</p>
                <Link to="/register" className="btn btn--primary btn--block mt-2">Choose {plan.name}</Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section container">
        <h2>Frequently asked questions</h2>
        <div className="grid grid--2 mt-4">
          <div className="card"><h4>Does it work with my theme?</h4><p className="muted">Yes. It uses WooCommerce hooks and never modifies core or your theme.</p></div>
          <div className="card"><h4>Will it slow down my store?</h4><p className="muted">No. Tracking is async and deferred, and heavy work runs in the cloud.</p></div>
          <div className="card"><h4>What happens if I cancel?</h4><p className="muted">Premium features pause immediately; your store keeps working normally.</p></div>
          <div className="card"><h4>Do you send SMS?</h4><p className="muted">Not at this time. We focus on email, web push, and WhatsApp-ready channels.</p></div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">© {new Date().getFullYear()} AI Revenue Recovery Engine. Built for WooCommerce.</div>
      </footer>
    </div>
  );
}
