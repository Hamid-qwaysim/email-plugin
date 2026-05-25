import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { API_VERSION, PRODUCT_NAME } from '@arre/shared';
import type { Env, JobMessage, Variables } from './env.js';
import { ulid } from './lib/ids.js';
import { ok, errors } from './lib/response.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { merchantRoutes } from './routes/merchant.js';
import { featureRoutes } from './routes/features.js';
import { pluginRoutes } from './routes/plugin.js';
import { aiRoutes } from './routes/ai.js';
import { agencyRoutes } from './routes/agency.js';
import { webhookRoutes } from './routes/webhooks.js';
import { handleQueue } from './queue.js';
import { runRecoveryScan } from './recovery-scan.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Per-request id for correlation in logs and API responses.
app.use('*', async (c, next) => {
  c.set('requestId', ulid());
  await next();
});

app.use('*', secureHeaders());

// CORS locked to the configured dashboard origins. Plugin (signed) calls are
// server-to-server and don't need CORS.
app.use('/v1/auth/*', corsForOrigins());
app.use('/v1/merchant/*', corsForOrigins());
app.use('/v1/admin/*', corsForOrigins());
app.use('/v1/agency/*', corsForOrigins());
app.use('/v1/ai/*', corsForOrigins());

function corsForOrigins() {
  return cors({
    origin: (origin, c) => {
      const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s: string) => s.trim());
      return origin && allowed.includes(origin) ? origin : allowed[0] ?? '';
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['authorization', 'content-type'],
    maxAge: 600,
    credentials: false,
  });
}

app.get('/', (c) => ok(c, { product: PRODUCT_NAME, status: 'ok', apiVersion: API_VERSION }));
app.get('/health', (c) => ok(c, { status: 'healthy', ts: Date.now() }));

// Mount route groups under the versioned prefix.
app.route('/v1/auth', authRoutes);
app.route('/v1/admin', adminRoutes);
app.route('/v1/merchant', merchantRoutes);
app.route('/v1/merchant', featureRoutes);
app.route('/v1/ai', aiRoutes);
app.route('/v1/agency', agencyRoutes);
app.route('/v1/plugin', pluginRoutes);
app.route('/v1/webhooks', webhookRoutes);

app.notFound((c) => errors.notFound(c, 'Route not found.'));
app.onError((err, c) => {
  console.error('unhandled_error', { requestId: c.get('requestId'), err: String(err) });
  return errors.internal(c);
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
    await handleQueue(batch, env);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runRecoveryScan(env));
  },
};
