-- Reference table for plans (billing display + admin). The authoritative
-- entitlement logic lives in @arre/shared/plans.ts; this mirrors it for SQL
-- joins, invoices and the super-admin billing views.

CREATE TABLE plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'usd',
  internal_only INTEGER NOT NULL DEFAULT 0,
  max_stores    INTEGER,
  max_contacts  INTEGER,
  max_monthly_events INTEGER,
  max_monthly_emails INTEGER,
  max_monthly_ai INTEGER,
  blurb         TEXT
);

INSERT INTO plans (id, name, price_cents, currency, internal_only, max_stores, max_contacts, max_monthly_events, max_monthly_emails, max_monthly_ai, blurb) VALUES
  ('free_test', 'Free Test / Beta', 0,     'usd', 1, 1,    500,    50000,   1000,    100,   'Admin-issued beta access with capped usage and an expiry date.'),
  ('starter',   'Starter',          2900,  'usd', 0, 1,    2000,   200000,  10000,   300,   'Core recovery, coupons and email for a single store.'),
  ('growth',    'Growth',           7900,  'usd', 0, 1,    15000,  1000000, 60000,   1500,  'Full automation, personalization and the Store Doctor.'),
  ('pro',       'Pro',              19900, 'usd', 0, 3,    75000,  5000000, 300000,  8000,  'Campaign generator, A/B testing, profit guard and monthly reports.'),
  ('agency',    'Agency',           49900, 'usd', 0, 25,   NULL,   NULL,    1000000, 30000, 'Multi-client management and white-label reporting for agencies.');
