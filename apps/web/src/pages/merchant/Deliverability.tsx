import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFirstStore } from '../../lib/useStore';
import { Badge, EmptyState, PageHeader, CardSkeleton, Section, Stat } from '../../components/ui';
import { Gauge } from '../../components/charts';

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

  if (loading || (storeId && !report)) return <CardSkeleton rows={5} />;
  if (!storeId) return <EmptyState title="Connect a store first" icon="🔌" />;

  return (
    <>
      <PageHeader title="Deliverability" sub="Keep your emails landing in the inbox" />
      <div className="grid grid--3">
        <div className="card center">
          <Gauge value={report!.score} label={`Grade ${report!.grade}`} />
          <div className="muted" style={{ fontSize: 13 }}>Deliverability score</div>
        </div>
        <Stat label="Bounce rate" value={`${report!.bounceRatePct}%`} sub="Target: under 2%" icon="↩️" />
        <Stat label="Complaint rate" value={`${report!.complaintRatePct}%`} sub="Target: under 0.1%" icon="🚩" />
      </div>
      <div className="mt-4">
        <Section title="Sender health checklist">
          <table className="table">
            <tbody>
              {report!.checklist.map((c) => (
                <tr key={c.item}>
                  <td>{c.item}</td>
                  <td style={{ width: 140 }}><Badge tone={c.ok ? 'ok' : 'warn'}>{c.ok ? 'Passing' : 'Action needed'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted mt-2" style={{ fontSize: 13 }}>Configure SPF/DKIM/DMARC in your DNS, then mark them in store brand settings to raise your score.</p>
        </Section>
      </div>
    </>
  );
}
