import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, Spinner } from '../../components/ui';

interface License {
  id: string;
  license_key: string;
  status: string;
  plan_id: string;
  is_test: number;
  max_stores: number;
  trial_ends_at: number | null;
}

export function MerchantLicense() {
  const [license, setLicense] = useState<License | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<{ license: License }>('/merchant/license').then((res) => {
      setLicense(res.data?.license ?? null);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <Spinner />;

  const active = license && ['active', 'trialing'].includes(license.status);

  return (
    <>
      <div className="main__head"><h1>License</h1></div>
      {!license ? (
        <div className="card">No license found for this account.</div>
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          <table className="table">
            <tbody>
              <tr><th>Key</th><td><code>{license.license_key}</code></td></tr>
              <tr><th>Status</th><td>
                <Badge tone={active ? 'ok' : 'off'}>{license.status}</Badge>
                {license.is_test ? <span style={{ marginLeft: 8 }}><Badge tone="warn">Test Mode</Badge></span> : null}
              </td></tr>
              <tr><th>Plan</th><td>{license.plan_id}</td></tr>
              <tr><th>Max stores</th><td>{license.max_stores}</td></tr>
              {license.trial_ends_at && (
                <tr><th>Trial ends</th><td>{new Date(license.trial_ends_at).toLocaleDateString()}</td></tr>
              )}
            </tbody>
          </table>
          <p className="muted mt-2">Use this key (and the one-time signing secret from the connect step) in the WordPress plugin’s Connection wizard.</p>
        </div>
      )}
    </>
  );
}
