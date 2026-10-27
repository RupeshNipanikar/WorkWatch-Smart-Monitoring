import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  ListTodo,
  Plus,
  Search,
  User,
  Calendar,
  Trash2,
  X,
  ArrowRight,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  dueDate: string;
  status: 'todo' | 'in_progress' | 'completed';
  createdBy: string;
  createdAt: string;
}

interface CRMModuleProps {
  user: UserProfile;
  isAdmin: boolean;
  employees?: UserProfile[];
}

const STATUS_META: Record<Task['status'], { label: string; iconBg: string; iconColor: string; icon: any }> = {
  todo: { label: 'To Do', iconBg: 'bg-slate-500/10', iconColor: 'text-slate-400', icon: ListTodo },
  in_progress: { label: 'In Progress', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400', icon: Clock },
  completed: { label: 'Completed', iconBg: 'bg-green-500/10', iconColor: 'text-green-400', icon: CheckCircle2 }
};

const COLUMN_ORDER: Task['status'][] = ['todo', 'in_progress', 'completed'];

const normalizeTask = (t: any): Task => ({
  id: String(t.id),
  title: t.title || 'Untitled Task',
  description: t.description || '',
  assignedTo: t.assignees || t.assignee_id || t.assigneeid || '',
  assignedToName: t.assignee_name || t.assigneename || 'Unassigned',
  dueDate: t.due_date || t.duedate || '',
  status: (t.status === 'in_progress' || t.status === 'completed') ? t.status : 'todo',
  createdBy: t.created_by || t.createdby || '',
  createdAt: t.created_at || t.createdat || new Date().toISOString()
});

export const CRMModule: React.FC<CRMModuleProps> = ({ user, isAdmin, employees = [] }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchTasks = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);

    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });

    if (error) {
      console.warn('tasks fetch error:', error.message);
      if (isInitial) setErrorMsg('Could not load tasks. Run the latest DATABASE_FIX.md script in Supabase.');
    } else if (data) {
      setErrorMsg(null);
      const normalized = data.map(normalizeTask);
      const filtered = isAdmin
        ? normalized
        : normalized.filter(t => t.assignedTo === user.uid);
      setTasks(filtered);
    }
    if (isInitial) setIsLoading(false);
  }, [isAdmin, user.uid]);

  useEffect(() => {
    fetchTasks(true);

    const channelName = `tasks-realtime-${user.uid}-${isAdmin ? 'admin' : 'emp'}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks(false);
      })
      .subscribe();

    // Fallback polling in case realtime isn't enabled on the tasks table
    const poll = setInterval(() => fetchTasks(false), 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [fetchTasks, user.uid, isAdmin]);

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !newTask.assignedTo) {
      setErrorMsg('Please provide a title and select an assignee.');
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);

    const assignee = employees.find(e => e.uid === newTask.assignedTo);

    const payload = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      assignees: newTask.assignedTo,
      assignee_name: assignee?.displayName || 'Unknown',
      due_date: newTask.dueDate,
      status: 'todo',
      created_by: user.uid,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('tasks').insert(payload).select();

    if (error) {
      console.error('Failed to create task:', error.message);
      setErrorMsg(`Failed to create task: ${error.message}`);
    } else {
      if (data) setTasks(prev => [normalizeTask(data[0]), ...prev]);
      setShowAddTask(false);
      setNewTask({ title: '', description: '', assignedTo: '', dueDate: format(new Date(), 'yyyy-MM-dd') });
    }
    setIsSaving(false);
  };

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
    if (error) {
      console.error('Failed to update task status:', error.message);
      fetchTasks(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setDeleteConfirmId(null);
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      console.error('Failed to delete task:', error.message);
      fetchTasks(false);
    }
  };

  const matchesSearch = (t: Task) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return t.title.toLowerCase().includes(term) ||
      (t.description || '').toLowerCase().includes(term) ||
      (t.assignedToName || '').toLowerCase().includes(term);
  };

  const filteredTasks = tasks.filter(matchesSearch);

  const dueDateBadge = (dueDate: string, status: Task['status']) => {
    if (!dueDate || status === 'completed') return null;
    try {
      const d = new Date(dueDate);
      if (isNaN(d.getTime())) return null;
      if (isPast(d) && !isToday(d)) {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">Overdue</span>;
      }
      if (isToday(d)) {
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Due Today</span>;
      }
    } catch (e) { /* ignore */ }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="text-blue-500" size={32} />
            Task Management
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin ? 'Assign and track tasks across your team.' : 'View and update the status of your assigned tasks.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setShowAddTask(true); setErrorMsg(null); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Plus size={20} /> Assign New Task
          </button>
        )}
      </div>

      <div className="relative flex-shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          type="text"
          placeholder="Search tasks by title, description, or assignee..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {errorMsg && !showAddTask && (
        <div className="flex items-center gap-3 px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex-shrink-0">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={40} className="text-slate-700 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMN_ORDER.map(colStatus => {
            const meta = STATUS_META[colStatus];
            const colTasks = filteredTasks.filter(t => t.status === colStatus);
            return (
              <div key={colStatus} className="flex flex-col bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden" style={{ maxHeight: '75vh' }}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.iconBg} ${meta.iconColor}`}>
                      <meta.icon size={18} />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{meta.label}</h3>
                  </div>
                  <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-[10px] font-black text-slate-400">
                    {colTasks.length}
                  </span>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-4 space-y-4">
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-700">
                      <meta.icon size={40} className="mb-3 opacity-30" />
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Nothing here</p>
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <div key={task.id} className="bg-slate-950/60 border border-slate-800 rounded-[1.5rem] p-5 hover:border-blue-500/30 transition-all group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-black text-white leading-snug line-clamp-2">{task.title}</h4>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmId(task.id)}
                              className="text-slate-700 hover:text-red-500 transition-colors flex-shrink-0 p-1 -m-1"
                              title="Delete task"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 mb-3">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 rounded-full px-3 py-1">
                            <User size={11} className="text-blue-400" />
                            {task.assignedToName}
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 rounded-full px-3 py-1">
                              <Calendar size={11} className="text-blue-400" />
                              {(() => {
                                try {
                                  const d = new Date(task.dueDate);
                                  return isNaN(d.getTime()) ? task.dueDate : format(d, 'MMM d, yyyy');
                                } catch { return task.dueDate; }
                              })()}
                            </div>
                          )}
                          {dueDateBadge(task.dueDate, task.status)}
                        </div>

                        {/* Status action — only the assignee (or admin) can move tasks forward */}
                        {(isAdmin || task.assignedTo === user.uid) && (
                          <div className="flex items-center gap-2">
                            {colStatus === 'todo' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                              >
                                Start <ArrowRight size={12} />
                              </button>
                            )}
                            {colStatus === 'in_progress' && (
                              <>
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'todo')}
                                  className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                  Back
                                </button>
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'completed')}
                                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                                >
                                  Complete <CheckCircle2 size={12} />
                                </button>
                              </>
                            )}
                            {colStatus === 'completed' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[3rem] p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                <Plus className="text-blue-500" /> Assign New Task
              </h3>
              <button onClick={() => setShowAddTask(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly DB Maintenance"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Assigned Employee</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                >
                  <option value="">Select Employee...</option>
                  {employees.map(emp => (
                    <option key={emp.uid} value={emp.uid}>{emp.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Due Date</label>
                <input
                  type="date"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Describe the task requirements..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={isSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl mx-auto flex items-center justify-center mb-5">
              <Trash2 size={28} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Delete this task?</h3>
            <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTask(deleteConfirmId)}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
