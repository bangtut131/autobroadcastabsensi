-- =============================================================
-- Supabase SQL: Create absensi_reminders table
-- Prefix "absensi_" dipakai supaya tidak konflik dengan tabel
-- dari aplikasi lain yang share database Supabase yang sama.
-- Run this in Supabase SQL Editor
-- =============================================================

CREATE TABLE IF NOT EXISTS absensi_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'umum',
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'recurring',
  cron_expr TEXT,
  send_at TIMESTAMPTZ,
  target TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_absensi_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_absensi_reminders_updated_at ON absensi_reminders;
CREATE TRIGGER update_absensi_reminders_updated_at
    BEFORE UPDATE ON absensi_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_absensi_reminders_updated_at();
