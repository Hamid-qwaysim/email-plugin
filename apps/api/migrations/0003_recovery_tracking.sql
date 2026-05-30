-- Track abandoned-cart recovery progress so the scheduled scan is idempotent
-- and never sends the same step twice.

ALTER TABLE abandoned_carts ADD COLUMN recovery_sent_steps TEXT; -- JSON array of step orders
ALTER TABLE abandoned_carts ADD COLUMN recovery_last_sent_at INTEGER;
