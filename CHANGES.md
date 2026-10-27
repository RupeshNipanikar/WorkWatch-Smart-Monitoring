# Fixes Applied

## 1. Call ringback removed (caller no longer hears a ring)
- `EmployeeDashboard.tsx` and `AdminDashboard.tsx`: removed `playRingbackTone()` from `startCall()`.
- Receiver side is unchanged and still plays `playIncomingCallTone()` via the `incoming-call` broadcast.
- Verified both `endCall()` functions already stop all local mic/camera tracks correctly.

## 2. Live feed stuck on "Connecting..."
- `LiveWebRTCMonitor.tsx`: the admin only sent one `request-live-stream` broadcast right after
  subscribing. If the employee's `calls:{uid}` channel wasn't joined yet, that request was lost
  with no retry. Added a 5-second retry loop (`statusRef` + `setInterval`) that keeps re-sending
  `request-live-stream` until `status === 'connected'`.

## 3. Camera black screen / intermittent stop
- `FaceTracker.tsx`: added `videoTrack.onended` handler that automatically restarts the camera if
  the track dies unexpectedly.
- `EmployeeDashboard.tsx` `startLiveWebRTC()`: previously called `getUserMedia()` a **second time**
  to get a stream for the WebRTC connection, competing with FaceTracker's own camera handle. This is
  the most likely root cause of intermittent camera dropouts. It now waits for and reuses
  FaceTracker's shared stream (`liveStreamRef`) instead of opening a second handle.

## 4. Chat messages not appearing
- Added `fetchMessages()` to the employee's 10s polling interval as a fallback in case Supabase
  Realtime isn't enabled on the `messages` table (admin side already had this).
- `DATABASE_FIX.md`: added a step that adds `messages`, `tasks`, `leave_requests`, and `users` to
  the `supabase_realtime` publication, since live updates require the table to be in that
  publication — this is a one-time DB-side setting that code alone cannot fix.

## 5. Leave Management tab showing nothing
- Root cause: `leave_requests` was created with an **unquoted** `userId` column in the original
  SQL fix script, which Postgres silently lowercases to `userid`. The app's query used
  `.eq('userId', user.uid)`, which doesn't match `userid` and returns an error, leaving
  `leaveHistory` permanently empty.
- `EmployeeDashboard.tsx` `fetchLeaveStatus()`: rewritten to fetch all leave rows and filter/normalize
  client-side across `userId` / `user_id` / `userid` / `uid`, so it works regardless of actual
  column casing.
- `DATABASE_FIX.md`: fixed the table definition to properly quote `"userId"`, `"employeeName"`,
  `"employeeCode"`, `"startDate"`, `"endDate"`, and added a migration step that renames an existing
  lowercase `userid` column back to `"userId"` if found, so old leave records aren't orphaned.

## 6. Task module rebuilt
- `CRMModule.tsx` was completely rewritten. The old version crashed (`t.description.toLowerCase()`
  on a null description) whenever a task had no description, which silently blanked the entire tab.
- New version: clean 3-column Kanban (To Do / In Progress / Completed), aligned to the exact
  `tasks` table schema in `DATABASE_FIX.md` (`title, description, assignees, assignee_name, due_date,
  status, created_by, created_at`). Admin can assign/delete tasks; employees see only their own and
  can move them through statuses. Includes due-date badges (Overdue / Due Today), search, realtime
  subscription + polling fallback, and proper independent scroll per column
  (`max-height: 75vh` + internal `overflow-y-auto`) so it works correctly inside the page's existing
  scroll layout.

## What still needs a DB-side action from you
- Run the updated `DATABASE_FIX.md` script in your Supabase SQL editor. This both fixes the
  `leave_requests` column casing at the source and enables Realtime on the relevant tables, which
  will make chat/tasks/leave update instantly instead of relying on the polling fallback.
- If chat messages still don't appear after that, check that `messages.receiverIds` is stored as a
  Postgres array/jsonb type (not a comma-separated string), since that's what `parseReceiverIds()`
  in the code expects.
