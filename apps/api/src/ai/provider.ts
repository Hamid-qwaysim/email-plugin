import type { Env } from '../env.js';

/**
 * AI provider abstraction. Production uses an OpenAI-compatible chat endpoint;
 * local/dev falls back to a deterministic mock so the whole product works with
 * no API key. Guardrails (no fake scarcity/reviews/illegal claims) are applied
 * as a system preamble.
 */
export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AiProviderName = 'openai_compatible' | 'anthropic' | 'mock';

export interface AiResult {
  text: string;
  model: string;
  provider: AiProviderName;
  tokens?: number;
}

const GUARDRAILS = [
  'You write ecommerce marketing copy for a WooCommerce store.',
  'Never invent fake reviews, fake testimonials, or fake scarcity.',
  'Only claim low stock or urgency when explicitly told inventory confirms it.',
  'Never make misleading discount or legal/health claims.',
  'Keep copy honest, concise, and on-brand.',
].join(' ');

export interface AiProvider {
  readonly name: AiProviderName;
  complete(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiResult>;
}

class MockProvider implements AiProvider {
  readonly name = 'mock' as const;
  async complete(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiResult> {
    const last = messages[messages.length - 1]?.content ?? '';
    if (opts?.json) {
      return {
        text: JSON.stringify({
          subject: 'You left something behind',
          preview: 'Complete your order in one click',
          body: `Hi there — we noticed you were interested. ${last.slice(0, 80)}`,
          cta: 'Return to cart',
        }),
        model: 'mock-1',
        provider: 'mock',
      };
    }
    return {
      text: `Still thinking it over? Your selection is waiting. Complete checkout whenever you're ready.`,
      model: 'mock-1',
      provider: 'mock',
    };
  }
}

class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai_compatible' as const;
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
  ) {}

  async complete(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      throw new Error(`AI provider error ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      model: this.model,
      provider: 'openai_compatible',
      tokens: data.usage?.total_tokens,
    };
  }
}

/** Anthropic (Claude) Messages API provider. */
class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const;
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
  ) {}

  async complete(messages: AiMessage[], opts?: { json?: boolean }): Promise<AiResult> {
    // Anthropic takes a top-level `system` string; only user/assistant turns go in messages.
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const sys = opts?.json ? `${system}\nRespond with ONLY valid JSON — no prose, no code fences.` : system;

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, max_tokens: 1024, system: sys, messages: turns }),
    });
    if (!res.ok) throw new Error(`Anthropic provider error ${res.status}`);
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return { text, model: this.model, provider: 'anthropic', tokens };
  }
}

export function getAiProvider(env: Env): AiProvider {
  const provider = env.AI_PROVIDER ?? (env.AI_API_KEY ? 'openai' : 'mock');

  if (provider === 'anthropic' && env.AI_API_KEY) {
    return new AnthropicProvider(
      env.AI_API_KEY,
      env.AI_BASE_URL ?? 'https://api.anthropic.com',
      env.AI_MODEL ?? 'claude-haiku-4-5-20251001',
    );
  }
  if ((provider === 'openai' || provider === 'openai_compatible') && env.AI_API_KEY) {
    return new OpenAiCompatibleProvider(
      env.AI_API_KEY,
      env.AI_BASE_URL ?? 'https://api.openai.com/v1',
      env.AI_MODEL ?? 'gpt-4o-mini',
    );
  }
  return new MockProvider();
}

export function withGuardrails(userPrompt: string, extraSystem?: string): AiMessage[] {
  return [
    { role: 'system', content: `${GUARDRAILS}${extraSystem ? ' ' + extraSystem : ''}` },
    { role: 'user', content: userPrompt },
  ];
}
