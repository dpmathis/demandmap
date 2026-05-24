-- Strictly additive migration: creates the device_tokens table and its
-- indexes. Does NOT touch any other table or column.
--
-- Apply with:
--   npx prisma db execute --file prisma/migrations/sql/create_device_tokens.sql

CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id"           text PRIMARY KEY,
  "tenant_id"    text NOT NULL,
  "user_id"      text NOT NULL,
  "platform"     text NOT NULL,
  "token"        text NOT NULL,
  "app_version"  text,
  "os_version"   text,
  "created_at"   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_platform_token_key"
  ON "device_tokens" ("platform", "token");

CREATE INDEX IF NOT EXISTS "device_tokens_tenant_id_user_id_idx"
  ON "device_tokens" ("tenant_id", "user_id");

CREATE INDEX IF NOT EXISTS "device_tokens_user_id_idx"
  ON "device_tokens" ("user_id");
