import { useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { EmptyState, Spinner } from '../../components/ui';

const SAMPLE = {
  brandColor: '#4f46e5',
  blocks: [
    { type: 'heading', text: 'You left something behind' },
    { type: 'text', text: 'Your cart is waiting. Complete your order in one click.' },
    { type: 'button', label: 'Return to cart', href: 'https://example.com/cart' },
    { type: 'coupon', code: 'SAVE10', description: '10% off, expires soon' },
    { type: 'footer', storeName: 'My Shop', unsubscribeUrl: 'https://example.com/unsub' },
  ],
};

export function MerchantEmailDesigner() {
  const { storeId, loading } = useFirstStore();
  const [doc, setDoc] = useState(JSON.stringify(SAMPLE, null, 2));
  const [html, setHtml] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  async function preview() {
    if (!storeId) return;
    setErr(null);
    let parsed: unknown;
    try { parsed = JSON.parse(doc); } catch { setErr('Invalid JSON'); return; }
    const res = await api<{ html: string }>(`/merchant/stores/${storeId}/email-preview`, { method: 'POST', body: { document: parsed } });
    if (res.ok && res.data) setHtml(res.data.html);
    else setErr(res.error?.message ?? 'Preview failed');
  }

  if (loading) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  return (
    <>
      <div className="main__head"><h1>Email Designer</h1></div>
      <div className="grid grid--2">
        <div className="card">
          <h3>Block document</h3>
          {err && <div className="alert alert--error">{err}</div>}
          <textarea className="input" style={{ height: 360, fontFamily: 'monospace', fontSize: 12 }} value={doc} onChange={(e) => setDoc(e.target.value)} />
          <button className="btn btn--primary mt-2" onClick={preview}>Render preview</button>
        </div>
        <div className="card">
          <h3>Preview</h3>
          {html ? (
            <iframe title="email-preview" srcDoc={html} style={{ width: '100%', height: 360, border: '1px solid var(--border)', borderRadius: 8 }} />
          ) : (
            <p className="muted">Click “Render preview” to see the email. Output is brand-styled, escaped, and mobile-friendly.</p>
          )}
        </div>
      </div>
    </>
  );
}
