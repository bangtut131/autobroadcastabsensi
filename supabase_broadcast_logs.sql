-- Run this SQL in Supabase SQL Editor to create the broadcast_logs table
-- This table is used for:
-- 1. Logging every broadcast sent (audit trail)
-- 2. Generating database write activity to prevent Supabase free tier auto-pause

CREATE TABLE IF NOT EXISTS broadcast_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL DEFAULT 'general',
  targets_count int DEFAULT 0,
  status text DEFAULT 'success',
  message text,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient querying by date
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created_at ON broadcast_logs (created_at DESC);

-- Optional: Enable Row Level Security (not required since we use service_role key)
-- ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;
