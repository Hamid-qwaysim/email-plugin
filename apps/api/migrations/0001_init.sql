-- AI Revenue Recovery Engine — initial schema (Cloudflare D1 / SQLite).
-- All ids are app-generated ULIDs/strings. Timestamps are unix milliseconds.
-- Money is stored in integer cents. JSON columns hold validated payloads.

PRAGMA foreign_keys = ON;

-- ============================================================ identity / orgs
CREATE TABLE organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'merchant', -- 'merchant' | 'agency'
  parent_org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL, -- agency -> client
  branding      TEXT, -- JSON: white-label settings
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_org_parent ON organizations(parent_org_id);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  status        TEXT NOT NULL DEFAULT 'active', -- 'active' | 'disabled'
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);

-- Membership maps a user to an org with a role (supports multi-org + agencies).
CREATE TABLE org_members (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL, -- shared Role
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id)
);
CREATE INDEX idx_members_user ON org_members(user_id);

-- ============================================================ billing/licensing
CREATE TABLE subscriptions (
  id                 TEXT PRIMARY KEY,
  org_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id            TEXT NOT NULL,
  status             TEXT NOT NULL, -- shared LicenseStatus mirror
  provider           TEXT,          -- 'stripe' | 'manual' | null
  provider_sub_id    TEXT,
  current_period_end INTEGER,
  cancel_at          INTEGER,
  canceled_at        INTEGER,
  cancel_reason      TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX idx_subs_org ON subscriptions(org_id);

CREATE TABLE licenses (
  id                    TEXT PRIMARY KEY,
  org_id                TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id       TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  license_key           TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'trialing',
  plan_id               TEXT NOT NULL DEFAULT 'free_test',
  entitlement_overrides TEXT,                 -- JSON map FeatureId->bool
  period_ends_at        INTEGER,
  trial_ends_at         INTEGER,
  grace_period_seconds  INTEGER NOT NULL DEFAULT 259200, -- 3 days
  cache_ttl_seconds     INTEGER NOT NULL DEFAULT 900,
  max_stores            INTEGER NOT NULL DEFAULT 1,
  kill_switch           INTEGER NOT NULL DEFAULT 0,
  bound_domain          TEXT,
  is_test               INTEGER NOT NULL DEFAULT 0,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX idx_licenses_org ON licenses(org_id);

CREATE TABLE license_activations (
  id           TEXT PRIMARY KEY,
  license_id   TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  store_id     TEXT,
  domain       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active', -- 'active' | 'deactivated'
  activated_at INTEGER NOT NULL,
  deactivated_at INTEGER,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX idx_activations_license ON license_activations(license_id);

CREATE TABLE license_validation_logs (
  id         TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  store_id   TEXT,
  decision   TEXT NOT NULL, -- 'active' | 'inactive'
  reason     TEXT,
  ip         TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_vallog_license ON license_validation_logs(license_id, created_at);

-- ============================================================ stores
CREATE TABLE stores (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_id      TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  domain          TEXT NOT NULL,
  store_type      TEXT NOT NULL DEFAULT 'general',
  signing_secret  TEXT NOT NULL,             -- per-store HMAC secret
  feature_toggles TEXT,                      -- JSON: local plugin toggles
  brand           TEXT,                      -- JSON: logo/colors/tone
  plugin_version  TEXT,
  wp_version      TEXT,
  woo_version     TEXT,
  hpos_enabled    INTEGER,
  connection_health TEXT DEFAULT 'unknown',  -- 'healthy'|'degraded'|'down'
  last_sync_at    INTEGER,
  last_seen_at    INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_stores_org ON stores(org_id);
CREATE INDEX idx_stores_domain ON stores(domain);

-- ============================================================ visitors/events
CREATE TABLE visitors (
  id            TEXT PRIMARY KEY,           -- our id
  store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  anon_id       TEXT NOT NULL,              -- first-party cookie id
  customer_id   TEXT,                       -- merged when identity known
  intent_score  INTEGER NOT NULL DEFAULT 0,
  intent_reason TEXT,                       -- explainable string
  device        TEXT,
  browser       TEXT,
  country       TEXT,
  city          TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  UNIQUE (store_id, anon_id)
);
CREATE INDEX idx_visitors_customer ON visitors(customer_id);
CREATE INDEX idx_visitors_intent ON visitors(store_id, intent_score);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visitor_id  TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  source      TEXT,
  utm         TEXT,                          -- JSON
  referrer    TEXT
);
CREATE INDEX idx_sessions_visitor ON sessions(visitor_id);

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visitor_id  TEXT,
  session_id  TEXT,
  type        TEXT NOT NULL,                 -- shared EventType
  props       TEXT,                          -- JSON
  cart_token  TEXT,
  client_ts   INTEGER,
  received_at INTEGER NOT NULL
);
CREATE INDEX idx_events_store_time ON events(store_id, received_at);
CREATE INDEX idx_events_visitor ON events(visitor_id, received_at);
CREATE INDEX idx_events_type ON events(store_id, type, received_at);

-- ============================================================ commerce
CREATE TABLE customers (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id        INTEGER,
  email         TEXT,
  name          TEXT,
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_recorded_at INTEGER,
  ltv_cents     INTEGER NOT NULL DEFAULT 0,
  aov_cents     INTEGER NOT NULL DEFAULT 0,
  orders_count  INTEGER NOT NULL DEFAULT 0,
  predicted_action TEXT,
  notes         TEXT,
  first_seen_at INTEGER,
  last_order_at INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (store_id, woo_id)
);
CREATE INDEX idx_customers_email ON customers(store_id, email);

CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id      INTEGER NOT NULL,
  name        TEXT,
  sku         TEXT,
  price_cents INTEGER,
  categories  TEXT,                          -- JSON array
  stock_status TEXT,
  stock_qty   INTEGER,
  image_url   TEXT,
  updated_at  INTEGER NOT NULL,
  UNIQUE (store_id, woo_id)
);

CREATE TABLE orders (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id       INTEGER NOT NULL,
  customer_id  TEXT,
  status       TEXT,
  total_cents  INTEGER,
  currency     TEXT,
  attributed_to TEXT,                        -- JSON: campaign/flow/coupon attribution
  recovered    INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  UNIQUE (store_id, woo_id)
);
CREATE INDEX idx_orders_customer ON orders(customer_id);

CREATE TABLE carts (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cart_token  TEXT NOT NULL,
  visitor_id  TEXT,
  customer_id TEXT,
  items       TEXT,                          -- JSON
  total_cents INTEGER,
  currency    TEXT,
  status      TEXT NOT NULL DEFAULT 'open',  -- 'open'|'abandoned'|'recovered'|'purchased'|'empty'
  updated_at  INTEGER NOT NULL,
  UNIQUE (store_id, cart_token)
);
CREATE INDEX idx_carts_status ON carts(store_id, status);

CREATE TABLE abandoned_carts (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cart_id       TEXT NOT NULL,
  stage         TEXT NOT NULL,               -- 'cart'|'checkout'|'browse'
  abandoned_at  INTEGER NOT NULL,
  recovered_at  INTEGER,
  recovery_flow_run_id TEXT,
  strategy      TEXT,                        -- AI-chosen strategy
  value_cents   INTEGER
);
CREATE INDEX idx_abandoned_store ON abandoned_carts(store_id, abandoned_at);

-- ============================================================ coupons
CREATE TABLE coupons (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  type          TEXT NOT NULL,               -- percentage|fixed|free_shipping|...
  amount        REAL,
  customer_email TEXT,
  cart_min_cents INTEGER,
  product_ids   TEXT,                        -- JSON
  category_ids  TEXT,                        -- JSON
  usage_limit   INTEGER NOT NULL DEFAULT 1,
  used_count    INTEGER NOT NULL DEFAULT 0,
  one_time      INTEGER NOT NULL DEFAULT 1,
  auto_apply    INTEGER NOT NULL DEFAULT 0,
  expires_at    INTEGER,
  source        TEXT,                        -- 'ai'|'manual'|'flow'
  ai_rationale  TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    INTEGER NOT NULL,
  UNIQUE (store_id, code)
);
CREATE INDEX idx_coupons_email ON coupons(store_id, customer_email);

-- ============================================================ automation
CREATE TABLE automations (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'autopilot', -- 'autopilot'|'manual'
  status      TEXT NOT NULL DEFAULT 'draft',     -- 'draft'|'active'|'paused'
  trigger     TEXT NOT NULL,                     -- trigger type
  definition  TEXT,                              -- JSON graph (nodes/edges)
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_automations_store ON automations(store_id, status);

CREATE TABLE automation_nodes (
  id            TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,               -- 'trigger'|'condition'|'delay'|'action'
  config        TEXT,                        -- JSON
  next_ids      TEXT,                        -- JSON array of node ids
  position      TEXT                         -- JSON {x,y} for the builder
);
CREATE INDEX idx_nodes_automation ON automation_nodes(automation_id);

CREATE TABLE automation_runs (
  id            TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  store_id      TEXT NOT NULL,
  subject_id    TEXT,                        -- visitor/customer id
  status        TEXT NOT NULL DEFAULT 'running', -- 'running'|'completed'|'stopped'|'failed'
  current_node  TEXT,
  context       TEXT,                        -- JSON run state
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE INDEX idx_runs_automation ON automation_runs(automation_id, status);

-- ============================================================ messaging
CREATE TABLE email_templates (
  id          TEXT PRIMARY KEY,
  store_id    TEXT REFERENCES stores(id) ON DELETE CASCADE, -- null = global/system
  name        TEXT NOT NULL,
  subject     TEXT,
  preview_text TEXT,
  blocks      TEXT,                          -- JSON block document
  is_system   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE emails (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  to_email      TEXT NOT NULL,
  customer_id   TEXT,
  template_id   TEXT,
  campaign_id   TEXT,
  automation_run_id TEXT,
  subject       TEXT,
  status        TEXT NOT NULL DEFAULT 'queued', -- queued|sent|delivered|bounced|failed
  provider      TEXT,
  provider_msg_id TEXT,
  idempotency_key TEXT,
  queued_at     INTEGER NOT NULL,
  sent_at       INTEGER,
  UNIQUE (store_id, idempotency_key)
);
CREATE INDEX idx_emails_store_status ON emails(store_id, status);

CREATE TABLE email_events (
  id         TEXT PRIMARY KEY,
  email_id   TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  store_id   TEXT NOT NULL,
  type       TEXT NOT NULL,                  -- open|click|bounce|complaint|unsubscribe|conversion
  meta       TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_emailevents_email ON email_events(email_id);

-- WhatsApp-ready + web push message log (no SMS).
CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,                 -- 'web_push'|'whatsapp'
  to_address  TEXT,
  template_id TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  provider    TEXT,
  created_at  INTEGER NOT NULL,
  sent_at     INTEGER
);

-- ============================================================ audience
CREATE TABLE segments (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'auto',  -- 'auto'|'custom'
  rules       TEXT,                          -- JSON rule tree
  is_excluded_default INTEGER NOT NULL DEFAULT 0,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE segment_memberships (
  id          TEXT PRIMARY KEY,
  segment_id  TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  store_id    TEXT NOT NULL,
  subject_id  TEXT NOT NULL,                 -- visitor or customer id
  added_at    INTEGER NOT NULL,
  UNIQUE (segment_id, subject_id)
);
CREATE INDEX idx_segmem_subject ON segment_memberships(subject_id);

-- ============================================================ onsite + recos
CREATE TABLE popups (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,                 -- popup|top_bar|slide_in|exit_intent|...
  status      TEXT NOT NULL DEFAULT 'draft',
  targeting   TEXT,                          -- JSON: segment/page rules
  design      TEXT,                          -- JSON
  content     TEXT,                          -- JSON
  frequency_cap TEXT,                        -- JSON
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE recommendations (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subject_id  TEXT,
  context     TEXT NOT NULL,                 -- 'email'|'popup'|'cart'|'dashboard'|...
  product_ids TEXT,                          -- JSON
  strategy    TEXT,
  rationale   TEXT,
  created_at  INTEGER NOT NULL
);

-- ============================================================ insights
CREATE TABLE store_doctor_insights (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period        TEXT NOT NULL,               -- 'daily'|'weekly'|'monthly'
  severity      TEXT NOT NULL DEFAULT 'info',
  title         TEXT NOT NULL,
  body          TEXT,
  recommended_action TEXT,
  est_impact_cents INTEGER,
  status        TEXT NOT NULL DEFAULT 'open', -- 'open'|'applied'|'dismissed'
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_insights_store ON store_doctor_insights(store_id, created_at);

CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  org_id      TEXT NOT NULL,
  kind        TEXT NOT NULL,                 -- 'monthly'|'weekly'|'agency'
  period_label TEXT,
  summary     TEXT,                          -- JSON metrics
  r2_key      TEXT,                          -- PDF location in R2
  status      TEXT NOT NULL DEFAULT 'generating',
  created_at  INTEGER NOT NULL
);

CREATE TABLE campaigns (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft', -- draft|scheduled|running|paused|done|failed
  goal_prompt TEXT,                          -- merchant's plain-language ask
  segment_id  TEXT,
  definition  TEXT,                          -- JSON: emails, coupon, timing, variants
  scheduled_at INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- ============================================================ AI + jobs + ops
CREATE TABLE ai_jobs (
  id          TEXT PRIMARY KEY,
  store_id    TEXT,
  kind        TEXT NOT NULL,                 -- 'campaign'|'email'|'subject'|'coupon'|...
  prompt_key  TEXT,
  input       TEXT,                          -- JSON
  output      TEXT,                          -- JSON
  model       TEXT,
  provider    TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  cost_tokens INTEGER,
  est_cost_cents INTEGER,
  error       TEXT,
  created_at  INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  payload      TEXT,
  status       TEXT NOT NULL DEFAULT 'queued', -- queued|processing|done|failed|dead
  attempts     INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  last_error   TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_jobs_idem ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE audit_logs (
  id         TEXT PRIMARY KEY,
  org_id     TEXT,
  actor_id   TEXT,
  actor_role TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  meta       TEXT,
  ip         TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at);

CREATE TABLE admin_actions (
  id         TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL,
  action     TEXT NOT NULL,                  -- 'impersonate'|'suspend'|'kill_switch'|...
  target     TEXT,
  reason     TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE plugin_diagnostics (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payload     TEXT,                          -- JSON diagnostic bundle
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_diag_store ON plugin_diagnostics(store_id, created_at);

CREATE TABLE billing_webhooks (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  event_type  TEXT,
  signature_ok INTEGER NOT NULL DEFAULT 0,
  payload     TEXT,
  processed   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE api_keys (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT,
  key_hash    TEXT NOT NULL,
  scopes      TEXT,                          -- JSON array
  last_used_at INTEGER,
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);

CREATE TABLE suppression_list (
  id         TEXT PRIMARY KEY,
  store_id   TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  reason     TEXT,                           -- 'unsubscribe'|'bounce'|'complaint'|'manual'
  created_at INTEGER NOT NULL,
  UNIQUE (store_id, email)
);

CREATE TABLE consent_records (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subject_id  TEXT,
  email       TEXT,
  channel     TEXT NOT NULL,                 -- 'email'|'web_push'|'whatsapp'
  granted     INTEGER NOT NULL,
  source      TEXT,
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_consent_store ON consent_records(store_id, email);

-- Feature entitlement audit (point-in-time overrides set by admins).
CREATE TABLE feature_entitlements (
  id          TEXT PRIMARY KEY,
  license_id  TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  feature_id  TEXT NOT NULL,
  enabled     INTEGER NOT NULL,
  set_by      TEXT,
  created_at  INTEGER NOT NULL,
  UNIQUE (license_id, feature_id)
);
