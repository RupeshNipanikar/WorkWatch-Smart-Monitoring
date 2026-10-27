# 🛠️ One-Click Database Fix

If you are running this locally and see errors like `column "displayName" does not exist` or `status 406`, copy and paste the entire script below into your **Supabase SQL Editor** and run it.

```sql
/**
 * ONE-CLICK FIX FOR WORKWATCH AI
 * This script ensures the table and all columns exist with correct case-sensitivity.
 */

-- 1. CREATE THE TABLE IF IT DOESN'T EXIST
CREATE TABLE IF NOT EXISTS public.users (
    uid TEXT PRIMARY KEY,
    email TEXT,
    "displayName" TEXT,
    "specialCode" TEXT UNIQUE,
    role TEXT DEFAULT 'employee',
    status TEXT DEFAULT 'offline',
    "hourlyRate" NUMERIC DEFAULT 0,
    "standardWorkingHours" NUMERIC DEFAULT 8,
    "sessionApprovalStatus" TEXT DEFAULT 'none',
    "cameraSnapshotUrl" TEXT,
    "screenSnapshotUrl" TEXT,
    "isMonitoringLive" BOOLEAN DEFAULT false,
    "isCameraOn" BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADD INDIVIDUAL COLUMNS (In case table existed but was missing them)
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "specialCode" TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "hourlyRate" NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "standardWorkingHours" NUMERIC DEFAULT 8;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "sessionApprovalStatus" TEXT DEFAULT 'none';
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "cameraSnapshotUrl" TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "screenSnapshotUrl" TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "isMonitoringLive" BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "isCameraOn" BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'employee';
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'offline';

-- 2.1 ADD CATEGORY TO MESSAGES
ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general';

-- 2.2 CREATE MISSING TABLES
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'normal',
    assignees TEXT, -- For multiple assignees
    "assignedTo" TEXT, -- Primary assignee UID
    "assignedToName" TEXT,
    "assignedBy" TEXT,
    "assignedByName" TEXT,
    "assignType" TEXT DEFAULT 'individual',
    "teamId" UUID,
    "dueDate" TEXT,
    due_date TEXT, -- Fallback
    status TEXT DEFAULT 'todo',
    "submissionNote" TEXT,
    "submittedAt" TIMESTAMP WITH TIME ZONE,
    "adminFeedback" TEXT,
    "approvedAt" TIMESTAMP WITH TIME ZONE,
    "rejectedAt" TIMESTAMP WITH TIME ZONE,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if table already exists
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'normal';
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedToName" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedBy" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedByName" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "submissionNote" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "adminFeedback" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "dueDate" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignType" TEXT DEFAULT 'individual';
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assign_type" TEXT DEFAULT 'individual';
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "teamId" UUID;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignees" TEXT;

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_no TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'open',
    assigned_to TEXT,
    created_by TEXT,
    created_by_name TEXT,
    message_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId TEXT,
    employeeName TEXT,
    employeeCode TEXT,
    startDate TEXT,
    endDate TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENSURE UNIQUE CONSTRAINT ON specialCode
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_specialcode_key') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_specialcode_key UNIQUE ("specialCode");
    END IF;
END $$;

-- 4. RELOAD SCHEMA CACHE (EXTREMELY IMPORTANT)
-- This tells Supabase to recognize the new columns immediately.
NOTIFY pgrst, 'reload';

-- 5. CREATE THE INITIAL ADMIN ACCOUNT
-- Login with:
-- Name: Admin
-- Code: 123456
INSERT INTO public.users (uid, "displayName", email, role, "specialCode", status, "hourlyRate")
VALUES ('admin-init-999', 'Admin', 'admin@local.test', 'admin', '123456', 'active', 1000)
ON CONFLICT (uid) DO UPDATE SET 
    "specialCode" = '123456', 
    role = 'admin', 
    "displayName" = 'Admin';

-- 6. STORAGE BUCKET SETUP
-- Ensure the "face-photos" bucket exists and is public.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('face-photos', 'face-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 7. FIX ROW LEVEL SECURITY (RLS) & MISSING COLUMNS
-- If you see "violates row-level security policy" or "column not found"
-- copy and paste this entire block into Supabase SQL Editor and run it.

-- Drop status constraint if it exists to allow all app statuses
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Disable RLS on all key tables
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.work_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments DISABLE ROW LEVEL SECURITY;

-- Ensure Tasks table has all columns from your schema (quoted and unquoted)
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedToName" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedBy" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignedByName" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "assignType" TEXT DEFAULT 'individual';
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "teamId" UUID;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "dueDate" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "submissionNote" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "adminFeedback" TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE;

-- Add snake_case fallbacks
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS admin_feedback TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS submission_note TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS due_date TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS assigned_by TEXT;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS assign_type TEXT DEFAULT 'individual';

-- Ensure support_tickets columns
ALTER TABLE IF EXISTS public.support_tickets ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE IF EXISTS public.support_tickets ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE IF EXISTS public.support_tickets ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE IF EXISTS public.support_tickets ADD COLUMN IF NOT EXISTS admin_feedback TEXT;

```

### **Why was it failing?**
1.  **Case Sensitivity:** PostgreSQL treats `displayName` as `displayname` (lowercase) unless it's wrapped in double quotes. My React code expects the exact `displayName` name.
2.  **Schema Cache:** Your local Supabase instance needs a "reload" notification to see new columns immediately.
3.  **Missing table:** If you didn't create the `users` table first, the ALTER commands would fail.

### **How to Login Now:**
1. Run the SQL above in Supabase.
2. Hard-refresh your browser.
3. Click **Admin Login**.
4. Enter **Admin** as Full Name and **123456** as Special Code.
