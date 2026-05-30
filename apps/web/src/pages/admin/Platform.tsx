import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, PageHeader, CardSkeleton, Section } from '../../components/ui';

interface Flag { id: string; name: string; category: string; premium: boolean }
interface Release { latestVersion: string; minimumVersion: string; installedVersions: { plugin_version: string; n: number }[] }
interface Diag { id: string; domain: string; created_at: number }

/** Combined Feature Flags + Plugin Releases + Diagnostics view. */
export function AdminPlatform() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [diags, setDiags] = useState<Diag[]>([]);

  useEffect(() => {
    api<{ features: Flag[] }>('/admin/feature-flags').then((r) => setFlags(r.data?.features ?? []));
    api<Release>('/admin/plugin-releases').then((r) => setRelease(r.data ?? null));
    api<{ diagnostics: Diag[] }>('/admin/diagnostics').then((r) => setDiags(r.data?.diagnostics ?? []));
  }, []);

  if (flags === null) return <CardSkeleton rows={8} />;

  return (
    <>
      <PageHeader title="Platform" sub="Feature flags, plugin releases, diagnostics" />

      <Section title="Plugin releases">
        {release && (
          <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
            <div><div className="muted" style={{ fontSize: 12 }}>Latest</div><strong>{release.latestVersion}</strong></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Minimum required</div><strong>{release.minimumVersion}</strong></div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12 }}>Installed across stores</div>
              {release.installedVersions.length === 0 ? <span>—</span> : release.installedVersions.map((v) => <span key={v.plugin_version} className="pill" style={{ marginRight: 6 }}>{v.plugin_version}: {v.n}</span>)}
            </div>
          </div>
        )}
      </Section>

      <div className="mt-4">
        <Section title="Global feature flags">
          <table className="table">
            <thead><tr><th>Feature</th><th>Category</th><th>Tier</th></tr></thead>
            <tbody>{flags.map((f) => <tr key={f.id}><td>{f.name}</td><td className="muted">{f.category}</td><td>{f.premium ? <Badge tone="warn">premium</Badge> : <Badge tone="ok">core</Badge>}</td></tr>)}</tbody>
          </table>
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Recent plugin diagnostics">
          {diags.length === 0 ? <p className="muted">No diagnostic bundles received yet.</p> : (
            <table className="table">
              <thead><tr><th>When</th><th>Store</th></tr></thead>
              <tbody>{diags.map((d) => <tr key={d.id}><td className="muted">{new Date(d.created_at).toLocaleString()}</td><td>{d.domain}</td></tr>)}</tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}
