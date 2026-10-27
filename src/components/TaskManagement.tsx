import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import {
  Plus, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  Send, Eye, Archive, Loader2, X, CheckCheck, Circle,
  FileText, User, Calendar, Flag, BarChart2, ClipboardList,
  Star, RefreshCw, Filter, Search
} from 'lucide-react';
import { format } from 'date-fns';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // userId
  assignedToName: string;
  assignedBy: string; // userId
  assignedByName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  dueDate: string;
  createdAt: string;
  progress: number; // 0-100
  submissionNote?: string;
  submittedAt?: string;
  reviewNote?: string;
  reviewedAt?: string;
  category?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-700 text-slate-300',
  medium: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',
  high: 'bg-orange-600/20 text-orange-400 border border-orange-500/30',
  urgent: 'bg-red-600/20 text-red-400 border border-red-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-700/50 text-slate-400',
  in_progress: 'bg-blue-600/20 text-blue-400',
  submitted: 'bg-yellow-600/20 text-yellow-400',
  approved: 'bg-green-600/20 text-green-400',
  rejected: 'bg-red-600/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

function safeFormat(dateStr: string | undefined, fmt: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return format(d, fmt);
  } catch { return '—'; }
}

// ─── Shared normalizer ───────────────────────────────────────────────────────
function normalizeTask(t: any): Task {
  return {
    id: t.id || t.task_id || '',
    title: t.title || '',
    description: t.description || '',
    assignedTo: t.assignedTo || t.assigned_to || '',
    assignedToName: t.assignedToName || t.assigned_to_name || '',
    assignedBy: t.assignedBy || t.assigned_by || '',
    assignedByName: t.assignedByName || t.assigned_by_name || '',
    priority: t.priority || 'medium',
    status: t.status || 'pending',
    dueDate: t.dueDate || t.due_date || '',
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    progress: t.progress ?? 0,
    submissionNote: t.submissionNote || t.submission_note || '',
    submittedAt: t.submittedAt || t.submitted_at,
    reviewNote: t.reviewNote || t.review_note || '',
    reviewedAt: t.reviewedAt || t.reviewed_at,
    category: t.category || '',
  };
}

// ─── Admin Task Management ─────────────────────────────────────────────────
interface AdminTasksProps {
  user: UserProfile;
  employees: UserProfile[];
}

export const AdminTaskManagement: React.FC<AdminTasksProps> = ({ user, employees }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reviewModal, setReviewModal] = useState<Task | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Create form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium' as Task['priority'],
    dueDate: '',
    category: '',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').select('*').order('createdAt', { ascending: false });
      let rows = data;
      if (error || !rows) {
        const { data: d2 } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
        rows = d2;
      }
      if (rows) setTasks(rows.map(normalizeTask));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    // Realtime subscription
    const channel = supabase.channel('tasks-admin').on(
      'postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  const createTask = async () => {
    if (!newTask.title.trim() || !newTask.assignedTo || !newTask.dueDate) {
      alert('Please fill in title, assignee, and due date.');
      return;
    }
    const emp = employees.find(e => e.uid === newTask.assignedTo);
    const now = new Date().toISOString();
    const payload = {
      title: newTask.title,
      description: newTask.description,
      assignedTo: newTask.assignedTo,
      assignedToName: emp?.displayName || emp?.name || 'Employee',
      assignedBy: user.uid,
      assignedByName: user.displayName,
      priority: newTask.priority,
      status: 'pending',
      dueDate: newTask.dueDate,
      createdAt: now,
      progress: 0,
      category: newTask.category,
    };
    const { error } = await supabase.from('tasks').insert(payload);
    if (error) {
      // try snake_case, then keep stripping any column Supabase reports as missing
      let snakePayload: any = {
        title: payload.title,
        description: payload.description,
        assigned_to: payload.assignedTo,
        assigned_to_name: payload.assignedToName,
        assigned_by: payload.assignedBy,
        assigned_by_name: payload.assignedByName,
        priority: payload.priority,
        status: payload.status,
        due_date: payload.dueDate,
        created_at: now,
        progress: 0,
        category: payload.category,
      };
      for (let i = 0; i < 10; i++) {
        const res = await supabase.from('tasks').insert(snakePayload);
        if (!res.error) break;
        const match = /find the '([^']+)' column/i.exec(res.error.message || '') || /'([^']+)' column of 'tasks'/i.exec(res.error.message || '');
        const missingKey = match ? Object.keys(snakePayload).find(k => k.toLowerCase() === match[1].toLowerCase()) : null;
        if (missingKey) {
          delete snakePayload[missingKey];
          continue;
        }
        break;
      }
    }
    setShowCreateModal(false);
    setNewTask({ title: '', description: '', assignedTo: '', priority: 'medium', dueDate: '', category: '' });
    fetchTasks();
  };

  const approveTask = async (task: Task) => {
    const payload = { status: 'approved', reviewNote, reviewedAt: new Date().toISOString(), progress: 100 };
    const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
    if (error) {
      await supabase.from('tasks').update({
        status: 'approved', review_note: reviewNote, reviewed_at: new Date().toISOString(), progress: 100
      }).eq('id', task.id);
    }
    setReviewModal(null);
    setReviewNote('');
    fetchTasks();
  };

  const rejectTask = async (task: Task) => {
    if (!reviewNote.trim()) { alert('Please provide a reason for rejection.'); return; }
    const payload = { status: 'rejected', reviewNote, reviewedAt: new Date().toISOString() };
    const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
    if (error) {
      await supabase.from('tasks').update({
        status: 'rejected', review_note: reviewNote, reviewed_at: new Date().toISOString()
      }).eq('id', task.id);
    }
    setReviewModal(null);
    setReviewNote('');
    fetchTasks();
  };

  const filteredTasks = tasks.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchSearch = !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assignedToName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Split into active and history
  const activeTasks = filteredTasks.filter(t => t.status !== 'approved');
  const historyTasks = filteredTasks.filter(t => t.status === 'approved');

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    submitted: tasks.filter(t => t.status === 'submitted').length,
    approved: tasks.filter(t => t.status === 'approved').length,
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Task Management</h2>
          <p className="text-slate-400 text-sm mt-1">Assign tasks, track progress, and review submissions.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <Plus size={18} /> Assign Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-white', icon: ClipboardList },
          { label: 'Pending', value: stats.pending, color: 'text-slate-400', icon: Circle },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400', icon: BarChart2 },
          { label: 'Review', value: stats.submitted, color: 'text-yellow-400', icon: Eye },
          { label: 'Approved', value: stats.approved, color: 'text-green-400', icon: CheckCircle },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <s.icon size={20} className={s.color} />
            <div>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" placeholder="Search tasks or employees..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Awaiting Review</option>
          <option value="rejected">Rejected</option>
          <option value="approved">Approved (History)</option>
        </select>
        <button onClick={fetchTasks} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Submitted - needs review banner */}
      {stats.submitted > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3">
          <Eye size={20} className="text-yellow-400 shrink-0" />
          <p className="text-yellow-300 font-bold text-sm">{stats.submitted} task{stats.submitted > 1 ? 's' : ''} awaiting your review</p>
        </div>
      )}

      {/* Active Tasks */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-400" />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Active Tasks</h3>
            {activeTasks.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl py-16 text-center">
                <ClipboardList size={40} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 font-bold">No active tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isAdmin
                    onReview={() => { setReviewModal(task); setReviewNote(''); }}
                    onSelect={() => setSelectedTask(task)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* History - Approved Tasks */}
          {(filterStatus === 'all' || filterStatus === 'approved') && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Archive size={14} /> Approved Task History
              </h3>
              {historyTasks.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl py-10 text-center">
                  <p className="text-slate-600 text-sm">No approved tasks yet</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 border-b border-slate-800">
                      <tr>
                        {['Task', 'Assigned To', 'Due Date', 'Approved On', 'Status'].map(h => (
                          <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {historyTasks.map(task => (
                        <tr key={task.id} className="hover:bg-slate-800/20 transition-all">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-200 text-sm">{task.title}</p>
                            {task.category && <p className="text-[10px] text-slate-500">{task.category}</p>}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{task.assignedToName}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{safeFormat(task.dueDate, 'MMM d, yyyy')}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{safeFormat(task.reviewedAt, 'MMM d, yyyy')}</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-green-600/20 text-green-400">APPROVED</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-lg max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Assign New Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Task Title *</label>
                <input
                  type="text" placeholder="Enter task title..."
                  value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
                <textarea
                  placeholder="Describe the task in detail..."
                  value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Assign To *</label>
                <select
                  value={newTask.assignedTo} onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="">Select employee...</option>
                  {employees.map(emp => (
                    <option key={emp.uid} value={emp.uid}>{emp.displayName || emp.name || emp.email}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Priority</label>
                  <select
                    value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Due Date *</label>
                  <input
                    type="date"
                    value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Category (optional)</label>
                <input
                  type="text" placeholder="e.g. Development, Design, Marketing..."
                  value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button onClick={createTask} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg">
                  Assign Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Review Submission</h3>
              <button onClick={() => setReviewModal(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="bg-slate-950/50 rounded-2xl p-4 mb-4 border border-slate-800">
              <p className="font-bold text-white">{reviewModal.title}</p>
              <p className="text-slate-400 text-sm mt-1">Submitted by {reviewModal.assignedToName}</p>
              {reviewModal.submissionNote && (
                <div className="mt-3 p-3 bg-slate-800 rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Employee Note</p>
                  <p className="text-slate-300 text-sm italic">"{reviewModal.submissionNote}"</p>
                </div>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Progress</span><span>{reviewModal.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${reviewModal.progress}%` }} />
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Review Note (optional for approval, required for rejection)</label>
              <textarea
                value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder="Add feedback or comments..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => rejectTask(reviewModal)}
                className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-bold py-3 rounded-xl transition-all border border-red-500/30"
              >
                Reject
              </button>
              <button
                onClick={() => approveTask(reviewModal)}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
              >
                Approve & Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} isAdmin />
      )}
    </div>
  );
};

// ─── Employee Task Management ───────────────────────────────────────────────
interface EmployeeTasksProps {
  user: UserProfile;
}

export const EmployeeTaskManagement: React.FC<EmployeeTasksProps> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [submitModal, setSubmitModal] = useState<Task | null>(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [progressValue, setProgressValue] = useState(100);
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').select('*')
        .eq('assignedTo', user.uid).order('createdAt', { ascending: false });
      let rows = data;
      if (error || !rows) {
        const { data: d2 } = await supabase.from('tasks').select('*')
          .eq('assigned_to', user.uid).order('created_at', { ascending: false });
        rows = d2;
      }
      if (rows) setTasks(rows.map(normalizeTask));
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    fetchTasks();
    const channel = supabase.channel(`tasks-emp-${user.uid}`).on(
      'postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks, user.uid]);

  const updateProgress = async (task: Task, value: number) => {
    const newStatus = value === 100 ? task.status : (value > 0 ? 'in_progress' : 'pending');
    await supabase.from('tasks').update({ progress: value, status: newStatus }).eq('id', task.id);
    fetchTasks();
  };

  const submitTask = async () => {
    if (!submitModal) return;
    const payload = {
      status: 'submitted',
      submissionNote,
      submittedAt: new Date().toISOString(),
      progress: progressValue,
    };
    const { error } = await supabase.from('tasks').update(payload).eq('id', submitModal.id);
    if (error) {
      await supabase.from('tasks').update({
        status: 'submitted',
        submission_note: submissionNote,
        submitted_at: new Date().toISOString(),
        progress: progressValue,
      }).eq('id', submitModal.id);
    }
    setSubmitModal(null);
    setSubmissionNote('');
    fetchTasks();
  };

  const activeTasks = tasks.filter(t => t.status !== 'approved');
  const historyTasks = tasks.filter(t => t.status === 'approved');

  const displayTasks = filterStatus === 'active' ? activeTasks : historyTasks;

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    submitted: tasks.filter(t => t.status === 'submitted').length,
    approved: tasks.filter(t => t.status === 'approved').length,
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-black text-white tracking-tight">My Tasks</h2>
        <p className="text-slate-400 text-sm mt-1">Track your assignments, update progress, and submit for review.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-slate-400', icon: Circle },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400', icon: BarChart2 },
          { label: 'Under Review', value: stats.submitted, color: 'text-yellow-400', icon: Eye },
          { label: 'Approved', value: stats.approved, color: 'text-green-400', icon: CheckCircle },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <s.icon size={20} className={s.color} />
            <div>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1 w-fit">
        {[{ key: 'active', label: 'Active Tasks' }, { key: 'history', label: 'Approved History' }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${filterStatus === tab.key ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-400" />
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl py-20 text-center">
          {filterStatus === 'active' ? (
            <>
              <ClipboardList size={40} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 font-bold">No active tasks assigned to you</p>
            </>
          ) : (
            <>
              <Archive size={40} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 font-bold">No approved tasks yet</p>
            </>
          )}
        </div>
      ) : filterStatus === 'active' ? (
        <div className="space-y-4">
          {displayTasks.map(task => (
            <EmployeeTaskCard
              key={task.id}
              task={task}
              onSubmit={() => { setSubmitModal(task); setProgressValue(task.progress || 100); }}
              onProgressUpdate={(v) => updateProgress(task, v)}
              onSelect={() => setSelectedTask(task)}
            />
          ))}
        </div>
      ) : (
        // Approved History table
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                {['Task', 'Category', 'Due Date', 'Approved On', 'Feedback'].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayTasks.map(task => (
                <tr key={task.id} className="hover:bg-slate-800/20 transition-all">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-200 text-sm">{task.title}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{task.category || '—'}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{safeFormat(task.dueDate, 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{safeFormat(task.reviewedAt, 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm italic max-w-xs">
                    {task.reviewNote ? `"${task.reviewNote}"` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit Modal */}
      {submitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Submit Task</h3>
              <button onClick={() => setSubmitModal(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="bg-slate-950/50 rounded-2xl p-4 mb-4 border border-slate-800">
              <p className="font-bold text-white">{submitModal.title}</p>
              <p className="text-slate-400 text-xs mt-1">{submitModal.description}</p>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Completion Progress</label>
              <input
                type="range" min={0} max={100} step={5}
                value={progressValue} onChange={e => setProgressValue(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className="text-center text-blue-400 font-black text-lg mt-2">{progressValue}%</p>
            </div>
            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Submission Note (optional)</label>
              <textarea
                value={submissionNote} onChange={e => setSubmissionNote(e.target.value)}
                placeholder="Describe what you completed, any issues faced..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSubmitModal(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all">
                Cancel
              </button>
              <button onClick={submitTask} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                <Send size={16} /> Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} isAdmin={false} />
      )}
    </div>
  );
};

// ─── Shared Task Card (Admin view) ─────────────────────────────────────────
const TaskCard: React.FC<{
  task: Task;
  isAdmin: boolean;
  onReview?: () => void;
  onSelect: () => void;
}> = ({ task, isAdmin, onReview, onSelect }) => (
  <div className={`bg-slate-900 border rounded-2xl p-5 transition-all hover:border-slate-700 ${task.status === 'submitted' ? 'border-yellow-500/40' : 'border-slate-800'}`}>
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
          {task.category && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">{task.category}</span>
          )}
        </div>
        <p className="font-bold text-white text-base truncate">{task.title}</p>
        {task.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{task.description}</p>}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] text-slate-500"><User size={11} /> {task.assignedToName}</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500"><Calendar size={11} /> Due {safeFormat(task.dueDate, 'MMM d, yyyy')}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onSelect} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
          <Eye size={16} />
        </button>
        {isAdmin && task.status === 'submitted' && onReview && (
          <button
            onClick={onReview}
            className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs px-3 py-2 rounded-xl transition-all"
          >
            <CheckCheck size={14} /> Review
          </button>
        )}
      </div>
    </div>
    {/* Progress bar */}
    {task.progress > 0 && (
      <div className="mt-4">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Progress</span><span>{task.progress}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${task.status === 'approved' ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>
    )}
  </div>
);

// ─── Employee Task Card ─────────────────────────────────────────────────────
const EmployeeTaskCard: React.FC<{
  task: Task;
  onSubmit: () => void;
  onProgressUpdate: (v: number) => void;
  onSelect: () => void;
}> = ({ task, onSubmit, onProgressUpdate, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [localProgress, setLocalProgress] = useState(task.progress);

  const canSubmit = task.status !== 'submitted' && task.status !== 'approved';

  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all ${task.status === 'rejected' ? 'border-red-500/40' : task.status === 'submitted' ? 'border-yellow-500/30' : 'border-slate-800'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
            </div>
            <p className="font-bold text-white text-base">{task.title}</p>
            {task.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{task.description}</p>}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-slate-500"><Calendar size={11} /> Due {safeFormat(task.dueDate, 'MMM d, yyyy')}</span>
              {task.category && <span className="text-[11px] text-slate-500">{task.category}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setExpanded(p => !p)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {canSubmit && (
              <button
                onClick={onSubmit}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-3 py-2 rounded-xl transition-all"
              >
                <Send size={14} /> Submit
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Progress</span><span>{localProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${task.status === 'approved' ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${localProgress}%` }}
            />
          </div>
          {canSubmit && (
            <input
              type="range" min={0} max={100} step={5}
              value={localProgress}
              onChange={e => setLocalProgress(Number(e.target.value))}
              onMouseUp={() => onProgressUpdate(localProgress)}
              onTouchEnd={() => onProgressUpdate(localProgress)}
              className="w-full mt-2 accent-blue-500 cursor-pointer"
            />
          )}
        </div>

        {/* Rejection note */}
        {task.status === 'rejected' && task.reviewNote && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">Rejected — Feedback</p>
            <p className="text-sm text-red-300 italic">"{task.reviewNote}"</p>
          </div>
        )}

        {/* Submitted confirmation */}
        {task.status === 'submitted' && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-2">
            <Eye size={14} className="text-yellow-400" />
            <p className="text-sm text-yellow-300 font-bold">Submitted — Awaiting admin review</p>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-800 p-5 bg-slate-950/30 space-y-3">
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Full Description</p>
            <p className="text-sm text-slate-300">{task.description || 'No description provided.'}</p>
          </div>
          {task.submissionNote && (
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Your Submission Note</p>
              <p className="text-sm text-slate-300 italic">"{task.submissionNote}"</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div><span className="font-bold">Assigned:</span> {safeFormat(task.createdAt, 'MMM d, yyyy')}</div>
            {task.submittedAt && <div><span className="font-bold">Submitted:</span> {safeFormat(task.submittedAt, 'MMM d, yyyy')}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Task Detail Modal ──────────────────────────────────────────────────────
const TaskDetailModal: React.FC<{ task: Task; onClose: () => void; isAdmin: boolean }> = ({ task, onClose, isAdmin }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-white">Task Details</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400"><X size={18} /></button>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${PRIORITY_COLORS[task.priority]}`}>{task.priority} priority</span>
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${STATUS_COLORS[task.status]}`}>{STATUS_LABELS[task.status]}</span>
        </div>
        <div>
          <p className="text-2xl font-black text-white">{task.title}</p>
          {task.category && <p className="text-slate-400 text-sm">{task.category}</p>}
        </div>
        {task.description && (
          <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Description</p>
            <p className="text-slate-300 text-sm leading-relaxed">{task.description}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Assigned To', value: task.assignedToName },
            { label: 'Assigned By', value: task.assignedByName },
            { label: 'Due Date', value: safeFormat(task.dueDate, 'MMM d, yyyy') },
            { label: 'Created', value: safeFormat(task.createdAt, 'MMM d, yyyy') },
          ].map(i => (
            <div key={i.label} className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">{i.label}</p>
              <p className="text-sm text-white font-bold">{i.value}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Overall Progress</span><span className="font-bold">{task.progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${task.status === 'approved' ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
        {task.submissionNote && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2">Submission Note</p>
            <p className="text-sm text-slate-300 italic">"{task.submissionNote}"</p>
            {task.submittedAt && <p className="text-[10px] text-slate-500 mt-2">Submitted {safeFormat(task.submittedAt, 'MMM d, yyyy · h:mm a')}</p>}
          </div>
        )}
        {task.reviewNote && (
          <div className={`rounded-2xl p-4 ${task.status === 'approved' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${task.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
              {task.status === 'approved' ? 'Approval Note' : 'Rejection Reason'}
            </p>
            <p className="text-sm text-slate-300 italic">"{task.reviewNote}"</p>
            {task.reviewedAt && <p className="text-[10px] text-slate-500 mt-2">Reviewed {safeFormat(task.reviewedAt, 'MMM d, yyyy · h:mm a')}</p>}
          </div>
        )}
      </div>
    </div>
  </div>
);
