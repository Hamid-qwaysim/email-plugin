import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, Spinner, Stat } from '../../components/ui';

interface Report {
  score: number;
  grade: string;
  bounceRatePct: number;
  complaintRatePct: number;
  checklist: { item: string; ok: boolean; severity: string }[];
}

export function MerchantDeliverability() {
  const { storeId, loading } = useFirstStore();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!storeId) return;
    api<Report>(`/merchant/stores/${storeId}/deliverability`).then((r) => setReport(r.data ?? null));
  }, [storeId]);

  if (loading || (storeId && !report)) return <Spinner />;
  if (!storeId) return <EmptyState title="Connect a store first" />;

  return (
    <>
      <div className="main__head"><h1>Deliverability</h1></div>
      <div className="grid grid--3">
        <Stat label="Deliverability score" value={`${report!.score} (${report!.grade})`} />
        <Stat label="Bounce rate" value={`${report!.bounceRatePct}%`} />
        <Stat label="Complaint rate" value={`${report!.complaintRatePct}%`} />
      </div>
      <div className="card mt-4">
        <h3>Sender health checklist</h3>
        <table className="table">
          <tbody>
            {report!.checklist.map((c) => (
              <tr key={c.item}>
                <td>{c.item}</td>
                <td><Badge tone={c.ok ? 'ok' : 'warn'}>{c.ok ? 'OK' : 'Action needed'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted mt-2">Set SPF/DKIM/DMARC status in your store brand settings to improve the score.</p>
      </div>
    </>
  );
}
