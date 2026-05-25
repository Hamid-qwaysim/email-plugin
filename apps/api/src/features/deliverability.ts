/**
 * Smart Deliverability System (#25). Computes a 0–100 deliverability score and
 * a prioritized checklist from auth (SPF/DKIM/DMARC) + sending health. Pure.
 */
export interface DeliverabilityInput {
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  sentLast30d: number;
  bounces: number;
  complaints: number;
  unsubscribes: number;
  suppressedCount: number;
}

export interface DeliverabilityReport {
  score: number; // 0..100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  bounceRatePct: number;
  complaintRatePct: number;
  checklist: { item: string; ok: boolean; severity: 'critical' | 'warn' | 'info' }[];
}

export function scoreDeliverability(i: DeliverabilityInput): DeliverabilityReport {
  const bounceRate = i.sentLast30d > 0 ? (i.bounces / i.sentLast30d) * 100 : 0;
  const complaintRate = i.sentLast30d > 0 ? (i.complaints / i.sentLast30d) * 100 : 0;

  let score = 100;
  if (!i.spf) score -= 20;
  if (!i.dkim) score -= 25;
  if (!i.dmarc) score -= 15;
  if (bounceRate > 2) score -= Math.min(20, (bounceRate - 2) * 5);
  if (complaintRate > 0.1) score -= Math.min(20, (complaintRate - 0.1) * 40);
  score = Math.max(0, Math.round(score));

  const checklist: DeliverabilityReport['checklist'] = [
    { item: 'SPF record published', ok: i.spf, severity: 'critical' },
    { item: 'DKIM signing enabled', ok: i.dkim, severity: 'critical' },
    { item: 'DMARC policy published', ok: i.dmarc, severity: 'warn' },
    { item: 'Bounce rate under 2%', ok: bounceRate <= 2, severity: 'warn' },
    { item: 'Complaint rate under 0.1%', ok: complaintRate <= 0.1, severity: 'critical' },
  ];

  return {
    score,
    grade: grade(score),
    bounceRatePct: round1(bounceRate),
    complaintRatePct: round1(complaintRate),
    checklist,
  };
}

function grade(score: number): DeliverabilityReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
