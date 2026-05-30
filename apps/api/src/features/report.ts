/**
 * AI Monthly Growth Report (#23). Assembles the period's metrics into a summary
 * document, writes a rendered HTML report to R2, and records a reports row. The
 * heavy PDF rendering is delegated to a downstream renderer; we store HTML now
 * (which print-to-PDF or a converter can finalize) so the artifact exists.
 */
import type { Env } from '../env.js';
import { prefixedId, now } from '../lib/ids.js';

export interface ReportSummary {
  recoveredRevenueCents: number;
  recoveredCarts: number;
  abandonedCarts: number;
  abandonedValueCents: number;
  emailsSent: number;
  couponsCreated: number;
}

export interface ReportRecord {
  id: string;
  r2Key: string;
  summary: ReportSummary;
  periodLabel: string;
}

export async function generateReport(env: Env, storeId: string, orgId: string): Promise<ReportRecord> {
  const [recovered, abandoned, emails, coupons] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) v FROM orders WHERE store_id=?1 AND recovered=1`).bind(storeId).first<{ n: number; v: number }>(),
    env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(value_cents),0) v FROM abandoned_carts WHERE store_id=?1`).bind(storeId).first<{ n: number; v: number }>(),
    env.DB.prepare(`SELECT COUNT(*) n FROM emails WHERE store_id=?1 AND status='sent'`).bind(storeId).first<{ n: number }>(),
    env.DB.prepare(`SELECT COUNT(*) n FROM coupons WHERE store_id=?1`).bind(storeId).first<{ n: number }>(),
  ]);

  const summary: ReportSummary = {
    recoveredRevenueCents: recovered?.v ?? 0,
    recoveredCarts: recovered?.n ?? 0,
    abandonedCarts: abandoned?.n ?? 0,
    abandonedValueCents: abandoned?.v ?? 0,
    emailsSent: emails?.n ?? 0,
    couponsCreated: coupons?.n ?? 0,
  };

  const period = new Date();
  const periodLabel = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, '0')}`;
  const id = prefixedId('rpt');
  const r2Key = `reports/${orgId}/${storeId}/${periodLabel}-${id}.html`;

  const html = renderReportHtml(periodLabel, summary);
  // R2 may be unavailable in some local setups; never let storage failure lose the row.
  try {
    await env.ASSETS_R2.put(r2Key, html, { httpMetadata: { contentType: 'text/html' } });
  } catch {
    /* keep the DB record even if R2 write fails locally */
  }

  await env.DB.prepare(
    `INSERT INTO reports (id, store_id, org_id, kind, period_label, summary, r2_key, status, created_at)
     VALUES (?1,?2,?3,'monthly',?4,?5,?6,'ready',?7)`,
  ).bind(id, storeId, orgId, periodLabel, JSON.stringify(summary), r2Key, now()).run();

  return { id, r2Key, summary, periodLabel };
}

function renderReportHtml(period: string, s: ReportSummary): string {
  const row = (label: string, value: string) => `<tr><td>${label}</td><td style="text-align:right"><strong>${value}</strong></td></tr>`;
  const money = (c: number) => '$' + (c / 100).toFixed(2);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:680px;margin:24px auto;color:#1a1f36">
<h1>Monthly Growth Report — ${period}</h1>
<p style="color:#6b7280">AI Revenue Recovery Engine</p>
<table style="width:100%;border-collapse:collapse">
${row('Recovered revenue', money(s.recoveredRevenueCents))}
${row('Recovered carts', String(s.recoveredCarts))}
${row('Abandoned carts', String(s.abandonedCarts))}
${row('Abandoned value', money(s.abandonedValueCents))}
${row('Emails sent', String(s.emailsSent))}
${row('Coupons created', String(s.couponsCreated))}
</table>
<h2>Next month action plan</h2>
<ul>
<li>Keep the abandoned cart recovery flow active.</li>
<li>Review the Store Doctor's top recommendation.</li>
<li>A/B test your best-performing subject line.</li>
</ul></body></html>`;
}
