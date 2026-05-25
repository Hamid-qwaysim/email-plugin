import type { Env } from '../env.js';

/**
 * Email provider abstraction: SendGrid-compatible HTTP API in production, SMTP
 * relay or a mock in dev. The mock "succeeds" without sending, so the whole
 * pipeline (queue → send → delivery log) is exercisable without credentials.
 */
export interface OutboundEmail {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  /** Per-message idempotency to make retries safe. */
  idempotencyKey?: string;
}

export interface SendResult {
  provider: 'sendgrid' | 'resend' | 'smtp' | 'mock';
  providerMessageId: string;
  accepted: boolean;
}

export interface EmailProvider {
  readonly name: SendResult['provider'];
  send(email: OutboundEmail): Promise<SendResult>;
}

class MockEmailProvider implements EmailProvider {
  readonly name = 'mock' as const;
  async send(email: OutboundEmail): Promise<SendResult> {
    return {
      provider: 'mock',
      providerMessageId: `mock-${email.idempotencyKey ?? Date.now()}`,
      accepted: true,
    };
  }
}

class SendgridProvider implements EmailProvider {
  readonly name = 'sendgrid' as const;
  constructor(private apiKey: string) {}
  async send(email: OutboundEmail): Promise<SendResult> {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: email.to }] }],
        from: { email: email.from },
        subject: email.subject,
        content: [
          ...(email.text ? [{ type: 'text/plain', value: email.text }] : []),
          { type: 'text/html', value: email.html },
        ],
      }),
    });
    return {
      provider: 'sendgrid',
      providerMessageId: res.headers.get('x-message-id') ?? `sg-${Date.now()}`,
      accepted: res.ok,
    };
  }
}

/** Resend (resend.com) — the simplest real ESP to adopt. */
class ResendProvider implements EmailProvider {
  readonly name = 'resend' as const;
  constructor(private apiKey: string) {}
  async send(email: OutboundEmail): Promise<SendResult> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        ...(email.text ? { text: email.text } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { provider: 'resend', providerMessageId: data.id ?? `re-${Date.now()}`, accepted: res.ok };
  }
}

export function getEmailProvider(env: Env): EmailProvider {
  const provider = env.EMAIL_PROVIDER ?? (env.EMAIL_API_KEY ? 'resend' : 'mock');
  if (provider === 'resend' && env.EMAIL_API_KEY) return new ResendProvider(env.EMAIL_API_KEY);
  if (provider === 'sendgrid' && env.EMAIL_API_KEY) return new SendgridProvider(env.EMAIL_API_KEY);
  return new MockEmailProvider();
}

/** Subject-line spam-risk heuristic for the deliverability dashboard. */
const SPAMMY = ['free!!!', '100% free', 'act now', 'risk-free', 'winner', 'cash bonus', '$$$', 'click here'];
export function subjectSpamRisk(subject: string): { score: number; flags: string[] } {
  const lower = subject.toLowerCase();
  const flags: string[] = [];
  for (const w of SPAMMY) if (lower.includes(w)) flags.push(w);
  if ((subject.match(/!/g)?.length ?? 0) > 1) flags.push('excessive_exclamation');
  if (subject === subject.toUpperCase() && subject.length > 8) flags.push('all_caps');
  return { score: Math.min(100, flags.length * 25), flags };
}
