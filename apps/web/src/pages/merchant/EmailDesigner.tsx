import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { EmptyState, PageHeader, Section, Spinner, useToast } from '../../components/ui';

type Block = { type: string; [k: string]: unknown };

const BLOCK_TYPES: { type: string; label: string; make: () => Block }[] = [
  { type: 'heading', label: 'Heading', make: () => ({ type: 'heading', text: 'New heading' }) },
  { type: 'text', label: 'Text', make: () => ({ type: 'text', text: 'Write something compelling…' }) },
  { type: 'button', label: 'Button', make: () => ({ type: 'button', label: 'Shop now', href: 'https://example.com' }) },
  { type: 'image', label: 'Image', make: () => ({ type: 'image', url: 'https://placehold.co/520x200', alt: 'Image' }) },
  { type: 'product', label: 'Product', make: () => ({ type: 'product', name: 'Product', priceCents: 1999, imageUrl: 'https://placehold.co/110', href: 'https://example.com/p' }) },
  { type: 'coupon', label: 'Coupon', make: () => ({ type: 'coupon', code: 'SAVE10', description: '10% off, expires soon' }) },
  { type: 'divider', label: 'Divider', make: () => ({ type: 'divider' }) },
  { type: 'footer', label: 'Footer', make: () => ({ type: 'footer', storeName: 'My Shop', unsubscribeUrl: 'https://example.com/unsub' }) },
];

const FIELDS: Record<string, string[]> = {
  heading: ['text'], text: ['text'], button: ['label', 'href'], image: ['url', 'alt'],
  product: ['name', 'priceCents', 'imageUrl', 'href'], coupon: ['code', 'description'],
  divider: [], footer: ['storeName', 'unsubscribeUrl'],
};

const DEFAULT: Block[] = [
  { type: 'heading', text: 'You left something behind' },
  { type: 'text', text: 'Your cart is waiting — complete your order in one click.' },
  { type: 'button', label: 'Return to cart', href: 'https://example.com/cart' },
  { type: 'coupon', code: 'SAVE10', description: '10% off, expires in 48h' },
  { type: 'footer', storeName: 'My Shop', unsubscribeUrl: 'https://example.com/unsub' },
];

export function MerchantEmailDesigner() {
  const { storeId, loading } = useFirstStore();
  const toast = useToast();
  const [brandColor, setBrandColor] = useState('#5b54f0');
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT);
  const [html, setHtml] = useState('');
  const [name, setName] = useState('Abandoned cart email');

  // Live preview (debounced) whenever the document changes.
  useEffect(() => {
    if (!storeId) return;
    const t = setTimeout(async () => {
      const res = await api<{ html: string }>(`/merchant/stores/${storeId}/email-preview`, { method: 'POST', body: { document: { brandColor, blocks } } });
      if (res.ok && res.data) setHtml(res.data.html);
    }, 350);
    return () => clearTimeout(t);
  }, [storeId, brandColor, blocks]);

  function update(i: number, key: string, value: string | number) {
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, [key]: value } : blk)));
  }
  function add(type: string) {
    const def = BLOCK_TYPES.find((b) => b.type === type)!.make();
    setBlocks((b) => [...b, def]);
  }
  function remove(i: number) { setBlocks((b) => b.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const copy = [...b];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  }
  async function saveTemplate() {
    if (!storeId) return;
    const res = await api(`/merchant/stores/${storeId}/email-templates`, { method: 'POST', body: { name, document: { brandColor, blocks } } });
    if (res.ok) toast.push('Template saved', 'ok'); else toast.push('Save failed', 'error');
  }

  if (loading) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  return (
    <>
      <PageHeader title="Email Designer" sub="Block editor with live preview" actions={
        <>
          <input className="input" style={{ width: 200 }} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn--primary" onClick={saveTemplate}>Save template</button>
        </>
      } />

      <div className="grid grid--2" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <Section title="Blocks">
          <div className="row" style={{ gap: 10, marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Brand color</label>
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: 40, height: 30, border: 'none', background: 'none' }} />
          </div>

          {blocks.map((blk, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 10, boxShadow: 'none', background: 'var(--surface-2)' }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 13, textTransform: 'capitalize' }}>{blk.type}</strong>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>↓</button>
                  <button className="btn btn--danger btn--sm" onClick={() => remove(i)}>✕</button>
                </div>
              </div>
              {FIELDS[blk.type]!.map((f) => (
                <div className="field" key={f} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12 }}>{f}</label>
                  <input className="input" value={String(blk[f] ?? '')}
                    onChange={(e) => update(i, f, f === 'priceCents' ? Number(e.target.value) : e.target.value)} />
                </div>
              ))}
              {FIELDS[blk.type]!.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>No options.</p>}
            </div>
          ))}

          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {BLOCK_TYPES.map((b) => (
              <button key={b.type} className="btn btn--ghost btn--sm" onClick={() => add(b.type)}>+ {b.label}</button>
            ))}
          </div>
        </Section>

        <Section title="Live preview">
          <iframe title="email-preview" srcDoc={html} style={{ width: '100%', height: 520, border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }} />
        </Section>
      </div>
    </>
  );
}
