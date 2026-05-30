import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { EmptyState, PageHeader, CardSkeleton, Section, useToast } from '../../components/ui';

interface Brand {
  logoUrl?: string; primaryColor?: string; tone?: string; language?: string;
  spf?: boolean; dkim?: boolean; dmarc?: boolean;
}

export function MerchantSettings() {
  const { storeId, loading } = useFirstStore();
  const toast = useToast();
  const [brand, setBrand] = useState<Brand>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    api<{ brand: Brand }>(`/merchant/stores/${storeId}/settings`).then((r) => { setBrand(r.data?.brand ?? {}); setReady(true); });
  }, [storeId]);

  async function save() {
    if (!storeId) return;
    const res = await api(`/merchant/stores/${storeId}/settings`, { method: 'PATCH', body: brand });
    if (res.ok) toast.push('Settings saved', 'ok'); else toast.push('Save failed', 'error');
  }
  async function exportData() {
    if (!storeId) return;
    const res = await api<unknown>(`/merchant/stores/${storeId}/data/export`);
    if (res.ok) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'arre-data-export.json'; a.click();
      URL.revokeObjectURL(url);
    }
  }
  async function erase() {
    if (!storeId) return;
    if (!confirm('This permanently erases tracking + customer data for this store. Continue?')) return;
    const res = await api(`/merchant/stores/${storeId}/data/erase`, { method: 'POST', body: { confirm: 'ERASE' } });
    if (res.ok) toast.push('Data erased', 'ok'); else toast.push('Erase failed', 'error');
  }

  if (loading || (storeId && !ready)) return <CardSkeleton rows={6} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  return (
    <>
      <PageHeader title="Settings" sub="Brand, deliverability auth, and data privacy" actions={<button className="btn btn--primary" onClick={save}>Save</button>} />

      <div className="grid grid--2">
        <Section title="Brand">
          <div className="field"><label>Logo URL</label><input className="input" value={brand.logoUrl ?? ''} onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })} /></div>
          <div className="field"><label>Primary color</label><input className="input" value={brand.primaryColor ?? '#5b54f0'} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} /></div>
          <div className="field"><label>Tone</label><input className="input" value={brand.tone ?? ''} onChange={(e) => setBrand({ ...brand, tone: e.target.value })} placeholder="friendly, helpful" /></div>
          <div className="field"><label>Language</label><input className="input" value={brand.language ?? 'en'} onChange={(e) => setBrand({ ...brand, language: e.target.value })} /></div>
        </Section>
        <Section title="Sending domain authentication">
          {(['spf', 'dkim', 'dmarc'] as const).map((k) => (
            <label className="row" key={k} style={{ gap: 10, padding: '6px 0' }}>
              <input type="checkbox" checked={!!brand[k]} onChange={(e) => setBrand({ ...brand, [k]: e.target.checked })} />
              <span style={{ textTransform: 'uppercase' }}>{k} verified</span>
            </label>
          ))}
          <p className="muted" style={{ fontSize: 13 }}>These feed your Deliverability score.</p>
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Data & privacy">
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn--ghost" onClick={exportData}>Export data (JSON)</button>
            <button className="btn btn--danger" onClick={erase}>Erase store data</button>
          </div>
          <p className="muted mt-2" style={{ fontSize: 13 }}>Export returns customers + consent records. Erase permanently deletes tracking and customer data for this store.</p>
        </Section>
      </div>
    </>
  );
}
