-- ─────────────────────────────────────────────────────────────────
-- WorkWatch AI — Task Management Table Migration
-- Run this in your Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  "assignedTo"    TEXT NOT NULL,       -- employee userId
  "assignedToName" TEXT,
  "assignedBy"    TEXT NOT NULL,       -- admin userId
  "assignedByName" TEXT,
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'rejected')),
  "dueDate"       DATE,
  "createdAt"     TIMESTAMPTZ DEFAULT now(),
  progress        INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  "submissionNote" TEXT,
  "submittedAt"   TIMESTAMPTZ,
  "reviewNote"    TEXT,
  "reviewedAt"    TIMESTAMPTZ,
  category        TEXT
);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access" ON tasks
  USING (true)
  WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Index for fast employee lookups
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks ("assignedTo");
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks ("createdAt" DESC);
