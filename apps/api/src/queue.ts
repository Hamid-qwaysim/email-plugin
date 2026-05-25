import type { Env, JobMessage } from './env.js';
import { computeIntent, type IntentInput } from './lib/intent.js';
import { getEmailProvider } from './email/provider.js';
import { now } from './lib/ids.js';
import { intentBand } from '@arre/shared';

/**
 * Durable, retry-safe queue consumer. Each message is processed independently;
 * throwing marks that message for retry (up to max_retries, then DLQ). We use
 * idempotent writes so retries are safe.
 */
export async function handleQueue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await processJob(msg.body, env);
      msg.ack();
    } catch (err) {
      console.error('job_failed', { kind: msg.body.kind, attempt: msg.attempts, err: String(err) });
      msg.retry();
    }
  }
}

async function processJob(job: JobMessage, env: Env): Promise<void> {
  switch (job.kind) {
    case 'score_visitor':
      return scoreVisitor(job.visitorId, job.storeId, env);
    case 'send_email':
      return sendEmail(job.emailId, job.storeId, env);
    case 'process_event_batch':
    case 'ai_generate':
    case 'coupon_decision':
    case 'generate_report':
    case 'handle_webhook':
      // Foundations: these are wired to enqueue; their heavy processing is
      // implemented incrementally per feature. They no-op safely for now.
      return;
    default:
      return;
  }
}

async function scoreVisitor(visitorId: string, storeId: string, env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT type, props FROM events WHERE store_id=?1 AND visitor_id=?2 ORDER BY received_at DESC LIMIT 100`,
  )
    .bind(storeId, visitorId)
    .all<{ type: string; props: string | null }>();

  const events: IntentInput[] = (rows.results ?? []).map((r) => ({
    type: r.type as IntentInput['type'],
    props: r.props ? JSON.parse(r.props) : undefined,
  }));
  if (!events.length) return;

  const result = computeIntent(events);
  await env.DB.prepare(
    `UPDATE visitors SET intent_score=?3, intent_reason=?4, last_seen_at=?5 WHERE store_id=?1 AND id=?2`,
  )
    .bind(storeId, visitorId, result.score, result.reason, now())
    .run();

  // High intent that has stalled is a strong recovery candidate.
  if (intentBand(result.score) === 'high') {
    // A recovery automation would be triggered here.
  }
}

async function sendEmail(emailId: string, storeId: string, env: Env): Promise<void> {
  const email = await env.DB.prepare(
    `SELECT id, to_email, subject, status FROM emails WHERE id=?1 AND store_id=?2`,
  )
    .bind(emailId, storeId)
    .first<{ id: string; to_email: string; subject: string; status: string }>();
  if (!email || email.status === 'sent') return; // idempotent

  // Suppression check (never email a suppressed contact).
  const suppressed = await env.DB.prepare(
    `SELECT 1 FROM suppression_list WHERE store_id=?1 AND email=?2`,
  )
    .bind(storeId, email.to_email)
    .first();
  if (suppressed) {
    await env.DB.prepare(`UPDATE emails SET status='failed' WHERE id=?1`).bind(emailId).run();
    return;
  }

  const provider = getEmailProvider(env);
  const result = await provider.send({
    to: email.to_email,
    from: env.EMAIL_FROM ?? 'noreply@airevenuerecovery.com',
    subject: email.subject,
    html: '<p>Your message.</p>',
    idempotencyKey: emailId,
  });

  await env.DB.prepare(
    `UPDATE emails SET status=?2, provider=?3, provider_msg_id=?4, sent_at=?5 WHERE id=?1`,
  )
    .bind(emailId, result.accepted ? 'sent' : 'failed', result.provider, result.providerMessageId, now())
    .run();
}
