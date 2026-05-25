import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { errors, ok } from '../lib/response.js';
import { getAiProvider, withGuardrails } from '../ai/provider.js';
import { subjectSpamRisk } from '../email/provider.js';
import { prefixedId, now } from '../lib/ids.js';

/** AI generation endpoints (merchant-authenticated). All output is editable. */
export const aiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

aiRoutes.use('*', requireAuth);

async function logAiJob(env: Env, storeId: string | null, kind: string, input: unknown, output: unknown, model: string, provider: string, tokens?: number) {
  await env.DB.prepare(
    `INSERT INTO ai_jobs (id, store_id, kind, input, output, model, provider, status, cost_tokens, created_at, completed_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,'done',?8,?9,?9)`,
  )
    .bind(prefixedId('aij'), storeId, kind, JSON.stringify(input).slice(0, 4000), JSON.stringify(output).slice(0, 8000), model, provider, tokens ?? null, now())
    .run();
}

/** POST /ai/campaign — plain-language goal → structured campaign draft. */
aiRoutes.post('/campaign', async (c) => {
  const body = await c.req.json<{ storeId?: string; goal?: string }>().catch(() => null);
  if (!body?.goal) return errors.badRequest(c, 'goal is required.');

  const ai = getAiProvider(c.env);
  const prompt = `Create a WooCommerce marketing campaign for this goal: "${body.goal}".
Return JSON with: name, targetSegment, couponStrategy, emailSequence (array of {subject, preview, body}), pushCopy, recommendedTiming, successPrediction.`;
  const result = await ai.complete(withGuardrails(prompt), { json: true });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    parsed = { raw: result.text };
  }
  await logAiJob(c.env, body.storeId ?? null, 'campaign', body.goal, parsed, result.model, result.provider, result.tokens);
  return ok(c, { campaign: parsed, provider: result.provider });
});

/** POST /ai/email — generate a single email (subject/preview/body/cta). */
aiRoutes.post('/email', async (c) => {
  const body = await c.req.json<{ storeId?: string; purpose?: string; brandTone?: string }>().catch(() => null);
  if (!body?.purpose) return errors.badRequest(c, 'purpose is required.');

  const ai = getAiProvider(c.env);
  const prompt = `Write a ${body.purpose} email. Tone: ${body.brandTone ?? 'friendly, helpful'}.
Return JSON: subject, preview, body, cta.`;
  const result = await ai.complete(withGuardrails(prompt), { json: true });
  let parsed: { subject?: string } = {};
  try {
    parsed = JSON.parse(result.text);
  } catch {
    parsed = { subject: result.text.slice(0, 80) };
  }
  const risk = parsed.subject ? subjectSpamRisk(parsed.subject) : { score: 0, flags: [] };
  await logAiJob(c.env, body.storeId ?? null, 'email', body.purpose, parsed, result.model, result.provider, result.tokens);
  return ok(c, { email: parsed, subjectSpamRisk: risk, provider: result.provider });
});

/** POST /ai/subject — subject line variants for A/B testing. */
aiRoutes.post('/subject', async (c) => {
  const body = await c.req.json<{ context?: string; count?: number }>().catch(() => null);
  if (!body?.context) return errors.badRequest(c, 'context is required.');
  const ai = getAiProvider(c.env);
  const n = Math.min(body.count ?? 3, 6);
  const result = await ai.complete(
    withGuardrails(`Write ${n} distinct email subject lines for: ${body.context}. Return JSON array "subjects".`),
    { json: true },
  );
  let subjects: string[] = [];
  try {
    const j = JSON.parse(result.text) as { subjects?: string[] };
    subjects = j.subjects ?? [];
  } catch {
    subjects = [result.text];
  }
  return ok(c, {
    subjects: subjects.map((s) => ({ text: s, spamRisk: subjectSpamRisk(s) })),
    provider: result.provider,
  });
});
