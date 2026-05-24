-- Strictly additive migration: creates the subscriptions table.
-- Does NOT touch any other table or column.
--
-- Apply with:
--   npx prisma db execute --file prisma/migrations/sql/create_subscriptions.sql \
--     --url "<DATABASE_URL>"

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id"                          text PRIMARY KEY,
  "tenant_id"                   text NOT NULL UNIQUE,
  "status"                      text NOT NULL DEFAULT 'none',
  "tier"                        text NOT NULL DEFAULT 'free',
  "current_period_end"          timestamp(3),
  "trial_end"                   timestamp(3),
  "revenuecat_subscriber_id"    text,
  "product_identifier"          text,
  "store"                       text,
  "created_at"                  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "subscriptions_revenuecat_subscriber_id_idx"
  ON "subscriptions" ("revenuecat_subscriber_id");
