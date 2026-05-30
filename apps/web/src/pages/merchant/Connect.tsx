import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { STORE_TYPES, STORE_TYPE_PRESETS } from '@arre/shared';

interface Created {
  storeId: string;
  licenseKey: string;
  signingSecret: string;
  storeType: string;
}

export function MerchantConnect() {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [storeType, setStoreType] = useState('general');
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<Created>('/merchant/stores', {
      method: 'POST',
      body: { name, domain, storeType },
    });
    setBusy(false);
    if (!res.ok || !res.data) setError(res.error?.message ?? 'Could not register store.');
    else setCreated(res.data);
  }

  return (
    <>
      <div className="main__head"><h1>Connect a store</h1></div>

      {created ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="alert alert--ok">Store registered. Copy these into the WordPress plugin now — the signing secret is shown only once.</div>
          <div className="field"><label>Store ID</label><input className="input" readOnly value={created.storeId} /></div>
          <div className="field"><label>License key</label><input className="input" readOnly value={created.licenseKey} /></div>
          <div className="field"><label>Signing secret (one-time)</label><input className="input" readOnly value={created.signingSecret} /></div>
          <p className="muted">In WordPress: <strong>AI Revenue → Connection</strong>, paste these three values and click Connect.</p>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          {error && <div className="alert alert--error">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Store name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Shop" />
            </div>
            <div className="field">
              <label>Store domain</label>
              <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="shop.example.com" required />
            </div>
            <div className="field">
              <label>Store type (seeds AI defaults)</label>
              <select className="input" value={storeType} onChange={(e) => setStoreType(e.target.value)}>
                {STORE_TYPES.map((t) => (
                  <option key={t} value={t}>{STORE_TYPE_PRESETS[t].label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn--primary" disabled={busy}>{busy ? 'Registering…' : 'Register store'}</button>
          </form>
        </div>
      )}
    </>
  );
}
