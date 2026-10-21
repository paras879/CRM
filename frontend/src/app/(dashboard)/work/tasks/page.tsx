'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { Task, Project, User, TaskStatus, TaskPriority, PaginatedResponse } from '@/types';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CheckSquare,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  ExternalLink,
  Kanban,
  List,
  Clock,
  UserCheck,
  CheckCircle2,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

const priorityColors: Record<TaskPriority, string> = {
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  MEDIUM: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  HIGH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  URGENT: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const statusColumns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'TODO', label: 'To Do', color: 'border-slate-500/30 text-slate-400' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-500/30 text-blue-600 dark:text-blue-400' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'border-amber-500/30 text-amber-600 dark:text-amber-400' },
  { id: 'DONE', label: 'Done', color: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
];

import { useSearchParams } from 'next/navigation';

export default function TasksPage() {
  const { user, hasPermission } = useAuth();
  // Only users who can see the staff directory may assign tasks to others
  const canAssignOthers = hasPermission('users.view');
  const currentUserId = user?.id;
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // View state: 'kanban' or 'list'
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'my' | 'overdue' | 'dueSoon'>(
    initialFilter === 'my' || initialFilter === 'overdue' || initialFilter === 'dueSoon'
      ? initialFilter
      : 'all'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Task Dialog State
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formProjectId, setFormProjectId] = useState('');
  const [formMilestoneId, setFormMilestoneId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
  const [formDueDate, setFormDueDate] = useState('');
  const [formEstimatedHours, setFormEstimatedHours] = useState('');
  const [formAssigneeIds, setFormAssigneeIds] = useState<string[]>([]);

  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const [projRes, usersRes] = await Promise.allSettled([
        apiFetch<any>('/projects?limit=100'),
        canAssignOthers ? apiFetch<any>('/users?limit=100') : Promise.reject(new Error('skip')),
      ]);
      if (projRes.status === 'fulfilled') {
        setProjects(projRes.value.data || []);
      }
      if (usersRes.status === 'fulfilled') {
        setStaffUsers(usersRes.value.data || usersRes.value.users || []);
      }
    } catch (e) {
      console.error('Error fetching aux data:', e);
    }
  }, [canAssignOthers]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: viewMode === 'kanban' ? '60' : '20',
      });

      if (search.trim()) params.append('search', search.trim());
      if (selectedProjectId) params.append('projectId', selectedProjectId);
      if (selectedPriority) params.append('priority', selectedPriority);

      if (filterMode === 'my' && currentUserId) {
        params.append('assignedToId', currentUserId);
      } else if (filterMode === 'overdue') {
        params.append('overdue', 'true');
      } else if (filterMode === 'dueSoon') {
        params.append('dueSoon', 'true');
      }

      const res = await apiFetch<any>(`/tasks?${params.toString()}`);
      setTasks(res.data || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalCount(res.meta?.total || (res.data ? res.data.length : 0));
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [page, viewMode, search, selectedProjectId, selectedPriority, filterMode, currentUserId]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await apiFetch(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      // Optimistic update locally
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error('Failed to change task status:', err);
      fetchTasks();
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formProjectId) return;
    setSubmitting(true);
    setCreateError(null);

    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId: formProjectId,
          milestoneId: formMilestoneId || undefined,
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          priority: formPriority,
          dueDate: formDueDate ? new Date(formDueDate).toISOString() : undefined,
          estimatedHours: formEstimatedHours ? parseFloat(formEstimatedHours) : undefined,
          assigneeIds: formAssigneeIds,
        }),
      });

      setOpenCreate(false);
      resetForm();
      fetchTasks();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormProjectId('');
    setFormMilestoneId('');
    setFormTitle('');
    setFormDescription('');
    setFormPriority('MEDIUM');
    setFormDueDate('');
    setFormEstimatedHours('');
    setFormAssigneeIds([]);
    setCreateError(null);
  };

  // Metrics
  const openCount = tasks.filter((t) => t.status !== 'DONE').length;
  const myAssignedCount = tasks.filter(
    (t) => t.status !== 'DONE' && t.assignees?.some((a) => a.userId === currentUserId)
  ).length;
  const overdueCount = tasks.filter((t) => t.isOverdue).length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  const selectedProjectObj = projects.find((p) => p.id === formProjectId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" />
            Task Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sprints, team assignments, task progression, and deadlines
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-secondary border border-border/70 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
          </div>

          <Button
            onClick={() => setOpenCreate(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* KPI Cards (Interactive & Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => {
            setFilterMode(filterMode === 'all' ? 'all' : 'all');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            filterMode === 'all' ? 'ring-2 ring-primary border-primary bg-primary/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Open Tasks
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : openCount}
              </h3>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Active workflow
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <CheckSquare className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterMode(filterMode === 'my' ? 'all' : 'my');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            filterMode === 'my' ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-500/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Assigned to Me
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : myAssignedCount}
              </h3>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Filter my tasks
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterMode(filterMode === 'overdue' ? 'all' : 'overdue');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            filterMode === 'overdue' ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Overdue Tasks
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : overdueCount}
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Past target due date
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterMode(filterMode === 'dueSoon' ? 'all' : 'dueSoon');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            filterMode === 'dueSoon' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : doneCount}
              </h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Closed deliverables
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/70 bg-card">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tasks..."
              className="pl-9 bg-secondary border-border/70 text-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Filter Mode Tabs */}
            <div className="flex items-center gap-1 bg-secondary rounded-md p-1 border border-border/70 text-xs">
              <button
                onClick={() => {
                  setFilterMode('all');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filterMode === 'all'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setFilterMode('my');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filterMode === 'my'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => {
                  setFilterMode('overdue');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filterMode === 'overdue'
                    ? 'bg-rose-500 text-white font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Overdue
              </button>
              <button
                onClick={() => {
                  setFilterMode('dueSoon');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filterMode === 'dueSoon'
                    ? 'bg-amber-500 text-white font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Due Soon
              </button>
            </div>

            {/* Project Filter */}
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* VIEW MODE 1: KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="flex flex-col rounded-xl bg-card border border-border/70 overflow-hidden"
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-border/70 bg-secondary/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{col.label}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task Cards Column */}
                <div className="p-3 space-y-3 flex-1 min-h-[450px] max-h-[750px] overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-xs italic">
                      No tasks in {col.label}
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <Card
                        key={task.id}
                        className="border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                      >
                        <CardContent className="p-3.5 space-y-2.5">
                          {/* Project Tag & Priority */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-primary font-medium truncate max-w-[140px] flex items-center gap-1">
                              <FolderKanban className="w-3 h-3 shrink-0" />
                              {task.project?.name || 'Project'}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                priorityColors[task.priority]
                              }`}
                            >
                              {task.priority}
                            </Badge>
                          </div>

                          {/* Task Title */}
                          <Link
                            href={`/work/tasks/${task.id}`}
                            className="text-xs font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 block"
                          >
                            {task.title}
                          </Link>

                          {/* Milestone tag */}
                          {task.milestone && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              {task.milestone.title || task.milestone.name}
                            </p>
                          )}

                          {/* Footer: Due date, Assignees, Quick Status Move */}
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                            {task.dueDate ? (
                              <span
                                className={`flex items-center gap-1 ${
                                  task.isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-muted-foreground'
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                {new Date(task.dueDate).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}

                            {/* Assignee Avatar Chips */}
                            <div className="flex items-center -space-x-1">
                              {task.assignees && task.assignees.length > 0 ? (
                                task.assignees.map((ta) => (
                                  <div
                                    key={ta.userId}
                                    title={ta.user?.name || ''}
                                    className="w-5 h-5 rounded-full bg-primary/20 text-primary border border-card flex items-center justify-center text-[9px] font-bold"
                                  >
                                    {ta.user?.name?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                ))
                              ) : null}
                            </div>
                          </div>

                          {/* Quick Status Move Dropdown */}
                          <div className="pt-1 flex justify-end">
                            <select
                              value={task.status}
                              onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                              className="text-[10px] bg-secondary/80 border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground focus:outline-none focus:text-foreground"
                            >
                              <option value="TODO">→ To Do</option>
                              <option value="IN_PROGRESS">→ In Progress</option>
                              <option value="IN_REVIEW">→ In Review</option>
                              <option value="DONE">✓ Done</option>
                            </select>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: TABLE LIST */}
      {viewMode === 'list' && (
        <Card className="border-border/70 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/70">
                  <TableHead className="font-semibold text-foreground">Task Title</TableHead>
                  <TableHead className="font-semibold text-foreground">Project</TableHead>
                  <TableHead className="font-semibold text-foreground">Milestone</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground">Assignees</TableHead>
                  <TableHead className="font-semibold text-foreground">Due Date</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckSquare className="w-10 h-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-foreground">No tasks found</p>
                        <p className="text-xs text-muted-foreground">
                          Try adjusting your search criteria or create a new task
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id} className="border-border/70 hover:bg-secondary/20">
                      <TableCell className="font-medium text-xs">
                        <Link
                          href={`/work/tasks/${task.id}`}
                          className="text-foreground hover:text-primary transition-colors font-semibold flex items-center gap-1.5"
                        >
                          {task.title}
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
                        </Link>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {task.project ? (
                          <Link
                            href={`/work/projects/${task.project.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {task.project.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {task.milestone?.title || task.milestone?.name || '—'}
                      </TableCell>

                      <TableCell>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                          className="h-7 px-2 rounded text-xs bg-secondary border border-border/70 text-foreground focus:outline-none"
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="DONE">Done</option>
                        </select>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            priorityColors[task.priority]
                          }`}
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center -space-x-1.5">
                          {task.assignees && task.assignees.length > 0 ? (
                            task.assignees.map((ta) => (
                              <div
                                key={ta.userId}
                                title={ta.user?.name || ''}
                                className="w-6 h-6 rounded-full bg-primary/20 text-primary border border-card flex items-center justify-center text-[10px] font-bold"
                              >
                                {ta.user?.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                            ))
                          ) : (
                            <span className="italic text-muted-foreground/60">Unassigned</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        {task.dueDate ? (
                          <span
                            className={`flex items-center gap-1 ${
                              task.isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-muted-foreground'
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Link href={`/work/tasks/${task.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs border-border/70">
                            Details
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div>
              Showing <strong className="text-foreground">{tasks.length}</strong> of{' '}
              <strong className="text-foreground">{totalCount}</strong> tasks
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 border-border/70 text-xs text-foreground"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 border-border/70 text-xs text-foreground"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* DIALOG: CREATE TASK */}
      <Dialog surface open={openCreate} onClose={() => setOpenCreate(false)} className="max-w-lg">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" /> Create New Task
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenCreate(false)}
              className="text-muted-foreground"
            >
              ✕
            </Button>
          </div>

          {createError && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Task Title *</label>
              <Input
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Implement OAuth SSO Flow"
                className="bg-secondary border-border/70 text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Project *</label>
                <select
                  required
                  value={formProjectId}
                  onChange={(e) => {
                    setFormProjectId(e.target.value);
                    setFormMilestoneId('');
                  }}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border/70 text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border/70 text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Due Date</label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Estimated Hours</label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 10"
                  value={formEstimatedHours}
                  onChange={(e) => setFormEstimatedHours(e.target.value)}
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Assignee</label>
              {canAssignOthers ? (
                <>
                  <select
                    value={formAssigneeIds[0] || ''}
                    onChange={(e) => setFormAssigneeIds(e.target.value ? [e.target.value] : [])}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border/70 text-foreground focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Unassigned</option>
                    {staffUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <div className="w-full h-9 px-3 flex items-center rounded-md bg-secondary border border-border/70 text-muted-foreground">
                  Assigned to you
                </div>
              )}
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Description</label>
              <textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Details, acceptance criteria..."
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border/70 text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenCreate(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              size="sm"
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
