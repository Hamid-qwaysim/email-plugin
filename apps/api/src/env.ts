/** Cloudflare bindings + secrets available to the Worker. */
export interface Env {
  // Bindings
  DB: D1Database;
  LICENSE_KV: KVNamespace;
  NONCE_KV: KVNamespace;
  ASSETS_R2: R2Bucket;
  JOBS_QUEUE: Queue<JobMessage>;

  // Vars
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
  DEFAULT_LICENSE_CACHE_TTL: string;

  // Secrets (set with `wrangler secret put`)
  JWT_SECRET: string;
  LICENSE_SIGNING_PEPPER: string;
  WEBHOOK_SIGNING_SECRET?: string;
  /** 'anthropic' | 'openai' | 'mock'. Defaults: anthropic if key + this set, else openai if key, else mock. */
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  /** 'resend' | 'sendgrid' | 'cloudflare' | 'mock'. */
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
}

/** Discriminated union of async jobs processed by the queue consumer. */
export type JobMessage =
  | { kind: 'send_email'; emailId: string; storeId: string }
  | { kind: 'ai_generate'; jobId: string; storeId: string }
  | { kind: 'coupon_decision'; cartId: string; storeId: string }
  | { kind: 'process_event_batch'; storeId: string; batchKey: string }
  | { kind: 'generate_report'; reportId: string; storeId: string }
  | { kind: 'handle_webhook'; webhookId: string }
  | { kind: 'score_visitor'; visitorId: string; storeId: string };

/** Request-scoped context populated by auth/signed middleware. */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: import('@arre/shared').Role;
}

export interface SignedStoreContext {
  storeId: string;
  licenseId: string;
  orgId: string;
}

export type Variables = {
  auth?: AuthContext;
  signedStore?: SignedStoreContext;
  requestId: string;
};
