-- Run this AFTER migration.sql completes in Supabase SQL Editor.
-- Tells Prisma this migration is already applied so it won't re-run it.

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations"
    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    gen_random_uuid()::text,
    'phase3_wallet_routes_placeholder_checksum',
    NOW(),
    '20260510100000_phase3_wallet_routes',
    NULL,
    NULL,
    NOW(),
    1
);
