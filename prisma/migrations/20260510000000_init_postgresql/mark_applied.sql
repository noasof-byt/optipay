-- Run this AFTER the migration.sql completes in Supabase SQL Editor.
-- It tells Prisma that this migration has already been applied,
-- so future `prisma migrate dev/deploy` runs won't try to re-run it.

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
    '10779ce5d36c3219d7b7c3f0739becd2774b29501d0aa03b7cc41b806ea79855',
    NOW(),
    '20260510000000_init_postgresql',
    NULL,
    NULL,
    NOW(),
    1
);
