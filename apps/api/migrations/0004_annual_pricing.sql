-- Switch public plans to annual pricing and add a "contact sales" tier.
-- Starter $97/yr, Growth $197/yr, Pro $249/yr, Agency = contact our team.

ALTER TABLE plans ADD COLUMN interval TEXT NOT NULL DEFAULT 'year';
ALTER TABLE plans ADD COLUMN contact_sales INTEGER NOT NULL DEFAULT 0;

UPDATE plans SET price_cents = 9700,  interval = 'year', contact_sales = 0 WHERE id = 'starter';
UPDATE plans SET price_cents = 19700, interval = 'year', contact_sales = 0 WHERE id = 'growth';
UPDATE plans SET price_cents = 24900, interval = 'year', contact_sales = 0 WHERE id = 'pro';
UPDATE plans SET price_cents = 0,     interval = 'year', contact_sales = 1,
  blurb = 'Custom plan for agencies — multi-client management and white-label reporting. Contact our team.'
  WHERE id = 'agency';
UPDATE plans SET interval = 'year' WHERE id = 'free_test';
