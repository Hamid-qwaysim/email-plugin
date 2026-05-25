import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { PLAN_IDS } from '@arre/shared';
import { Badge, Spinner } from '../../components/ui';

interface License {
  id: string;
  org_id: string;
  license_key: string;
  status: string;
  plan_id: string;
  kill_switch: number;
  is_test: number;
}

export function AdminLicenses() {
  const [licenses, setLicenses] = useState<License[] | null>(null);
  const [orgId, setOrgId] = useState('');
  const [planId, setPlanId] = useState('free_test');
  const [trialDays, setTrialDays] = useState(14);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api<{ licenses: License[] }>('/admin/licenses').then((r) => setLicenses(r.data?.licenses ?? []));
  }
  useEffect(load, []);

  async function issue(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await api<{ licenseKey: string }>('/admin/licenses', {
      method: 'POST',
      body: { orgId, planId, isTest: planId === 'free_test', trialDays: trialDays || undefined },
    });
    if (res.ok && res.data) {
      setMsg(`Issued license ${res.data.licenseKey}`);
      load();
    } else {
      setMsg(res.error?.message ?? 'Failed to issue.');
    }
  }

  async function toggleKill(id: string, killed: boolean) {
    await api(`/admin/licenses/${id}/kill`, { method: 'POST', body: { killed } });
    load();
  }

  if (licenses === null) return <Spinner />;

  return (
    <>
      <div className="main__head"><h1>Licenses</h1></div>

      <div className="card" style={{ maxWidth: 720 }}>
        <h3>Issue a license (free/test/beta or paid)</h3>
        {msg && <div className="alert alert--ok">{msg}</div>}
        <form onSubmit={issue} className="grid grid--4" style={{ alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Org ID</label>
            <input className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="org_…" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Plan</label>
            <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {PLAN_IDS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Trial days</label>
            <input className="input" type="number" value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
          </div>
          <button className="btn btn--primary">Issue</button>
        </form>
      </div>

      <div className="card mt-4">
        <h3>All licenses</h3>
        {licenses.length === 0 ? (
          <p className="muted">No licenses yet. Issue one above.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Key</th><th>Org</th><th>Plan</th><th>Status</th><th>Kill switch</th><th></th></tr></thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id}>
                  <td><code>{l.license_key}</code></td>
                  <td className="muted">{l.org_id}</td>
                  <td>{l.plan_id}{l.is_test ? ' (test)' : ''}</td>
                  <td><Badge tone={['active', 'trialing'].includes(l.status) ? 'ok' : 'off'}>{l.status}</Badge></td>
                  <td>{l.kill_switch ? <Badge tone="warn">KILLED</Badge> : '—'}</td>
                  <td>
                    <button className={l.kill_switch ? 'btn btn--ghost' : 'btn btn--danger'} onClick={() => toggleKill(l.id, !l.kill_switch)}>
                      {l.kill_switch ? 'Restore' : 'Kill now'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
