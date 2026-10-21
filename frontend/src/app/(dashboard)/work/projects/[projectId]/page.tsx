'use client';
import { AttachmentsPanel } from '@/components/ui/attachments-panel';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { Project, Milestone, Task, TimeEntry, User, ProjectStatus, TaskPriority, MilestoneStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Users,
  Plus,
  ArrowLeft,
  Archive,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  DollarSign,
  UserCheck,
  Trash2,
  CheckSquare,
  FileText,
} from 'lucide-react';

const statusColors: Record<ProjectStatus, string> = {
  PLANNING: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  ACTIVE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  ON_HOLD: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const priorityColors: Record<TaskPriority, string> = {
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  MEDIUM: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  HIGH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  URGENT: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

type ActiveTab = 'overview' | 'members' | 'milestones' | 'tasks' | 'time';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [staffUsers, setStaffUsers] = useState<User[]>([]);

  // Dialog States
  const [openAddMember, setOpenAddMember] = useState(false);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [openAddMilestone, setOpenAddMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneSubmitting, setMilestoneSubmitting] = useState(false);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const [openAddTask, setOpenAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskMilestoneId, setTaskMilestoneId] = useState('');
  const [taskEstimatedHours, setTaskEstimatedHours] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [openLogTime, setOpenLogTime] = useState(false);
  const [timeTaskId, setTimeTaskId] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('60');
  const [timeDescription, setTimeDescription] = useState('');
  const [timeBillable, setTimeBillable] = useState(true);
  const [timeSubmitting, setTimeSubmitting] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  const fetchProjectDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ project: Project }>(`/projects/${projectId}`);
      setProject(res.project);
    } catch (err) {
      console.error('Failed to fetch project details:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchStaffUsers = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/users?limit=100');
      setStaffUsers(res.data || res.users || []);
    } catch (e) {
      console.error('Error fetching staff users:', e);
    }
  }, []);

  useEffect(() => {
    fetchProjectDetails();
    fetchStaffUsers();
  }, [fetchProjectDetails, fetchStaffUsers]);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!project) return;
    try {
      await apiFetch(`/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchProjectDetails();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleArchiveToggle = async () => {
    if (!project) return;
    try {
      const endpoint = project.isArchived
        ? `/projects/${project.id}/restore`
        : `/projects/${project.id}/archive`;
      await apiFetch(endpoint, { method: 'PATCH' });
      fetchProjectDetails();
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberUserId) return;
    setMemberSubmitting(true);
    setMemberError(null);
    try {
      await apiFetch(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: memberUserId, role: memberRole }),
      });
      setOpenAddMember(false);
      setMemberUserId('');
      setMemberRole('MEMBER');
      fetchProjectDetails();
    } catch (err: any) {
      setMemberError(err.message || 'Failed to add member');
    } finally {
      setMemberSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member from the project?')) return;
    try {
      await apiFetch(`/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      });
      fetchProjectDetails();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;
    setMilestoneSubmitting(true);
    setMilestoneError(null);
    try {
      await apiFetch('/milestones', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name: milestoneTitle.trim(),
          title: milestoneTitle.trim(),
          description: milestoneDescription.trim() || undefined,
          dueDate: milestoneDueDate ? new Date(milestoneDueDate).toISOString() : undefined,
          status: 'PENDING',
        }),
      });
      setOpenAddMilestone(false);
      setMilestoneTitle('');
      setMilestoneDescription('');
      setMilestoneDueDate('');
      fetchProjectDetails();
    } catch (err: any) {
      setMilestoneError(err.message || 'Failed to create milestone');
    } finally {
      setMilestoneSubmitting(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setTaskSubmitting(true);
    setTaskError(null);
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          priority: taskPriority,
          dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
          milestoneId: taskMilestoneId || undefined,
          estimatedHours: taskEstimatedHours ? parseFloat(taskEstimatedHours) : undefined,
          assigneeIds: taskAssigneeId ? [taskAssigneeId] : [],
        }),
      });
      setOpenAddTask(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      setTaskMilestoneId('');
      setTaskAssigneeId('');
      setTaskEstimatedHours('');
      fetchProjectDetails();
    } catch (err: any) {
      setTaskError(err.message || 'Failed to create task');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    setTimeSubmitting(true);
    setTimeError(null);
    try {
      const minutes = parseInt(timeMinutes, 10) || 60;
      await apiFetch('/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          taskId: timeTaskId || undefined,
          startedAt: new Date(Date.now() - minutes * 60000).toISOString(),
          endedAt: new Date().toISOString(),
          minutes,
          description: timeDescription.trim() || undefined,
          billable: timeBillable,
        }),
      });
      setOpenLogTime(false);
      setTimeTaskId('');
      setTimeDescription('');
      setTimeMinutes('60');
      fetchProjectDetails();
    } catch (err: any) {
      setTimeError(err.message || 'Failed to log time');
    } finally {
      setTimeSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading project details...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Project Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested project does not exist or has been removed.
        </p>
        <Link href="/work/projects">
          <Button variant="outline" className="border-border/70 text-foreground">
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const deadline = project.deadline || project.dueDate;
  const isOverdue =
    deadline &&
    new Date(deadline) < new Date() &&
    project.status !== 'COMPLETED' &&
    project.status !== 'CANCELLED';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/work/projects">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 border-border/70 text-foreground hover:bg-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {project.name}
              </h1>
              {project.isArchived && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">
                  Archived
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>Customer:</span>
              {project.customer ? (
                <Link
                  href={`/crm/customers/${project.customer.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {project.customer.companyName || project.customer.name}
                </Link>
              ) : (
                <span className="italic">Internal Project</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Status Select */}
          <select
            value={project.status}
            onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
            className="h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleArchiveToggle}
            className="h-9 text-xs border-border/70 text-foreground gap-1.5"
          >
            {project.isArchived ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Restore
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" /> Archive
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => setOpenAddTask(true)}
            className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </Button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Overall Progress</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">{project.progress}%</span>
            <span className="text-xs text-muted-foreground">
              {project.tasks?.filter((t) => t.status === 'DONE').length || 0}/
              {project.tasks?.length || 0} tasks
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full ${
                project.progress === 100
                  ? 'bg-emerald-500'
                  : project.progress >= 50
                  ? 'bg-primary'
                  : 'bg-blue-400'
              }`}
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </Card>

        <Card className="border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Target Deadline</p>
          <div className="mt-2">
            <span
              className={`text-lg font-bold flex items-center gap-1.5 ${
                isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}
            >
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {deadline ? new Date(deadline).toLocaleDateString() : 'No date set'}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {isOverdue ? 'Past due date' : 'On schedule'}
            </p>
          </div>
        </Card>

        <Card className="border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Tracked Hours</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">
              {project.timeSummary?.totalHours || 0} hrs
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              {project.timeSummary?.billableHours || 0} billable
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {project.timeEntries?.length || 0} entries recorded
          </p>
        </Card>

        <Card className="border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-medium">Budget</p>
          <div className="mt-2">
            <span className="text-xl font-bold text-foreground">
              {project.budget
                ? `${project.currency} ${project.budget.toLocaleString()}`
                : 'Not specified'}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              PM: {project.projectManager?.name || 'Unassigned'}
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-px">
        {[
          { id: 'overview', label: 'Overview', icon: FileText, count: null },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: project.tasks?.length },
          { id: 'milestones', label: 'Milestones', icon: Layers, count: project.milestones?.length },
          { id: 'members', label: 'Members', icon: Users, count: project.members?.length },
          { id: 'time', label: 'Time Tracking', icon: Clock, count: project.timeEntries?.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`px-4 py-2.5 text-xs font-medium rounded-t-md transition-colors flex items-center gap-2 border-b-2 -mb-px ${
                isActive
                  ? 'border-primary text-primary bg-primary/5 font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/70 bg-card">
              <CardHeader className="pb-3 border-b border-border/70">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Description & Deliverables
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs text-foreground leading-relaxed">
                {project.description ? (
                  <p className="whitespace-pre-line">{project.description}</p>
                ) : (
                  <p className="text-muted-foreground italic">No description provided.</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Milestones Summary */}
            <Card className="border-border/70 bg-card">
              <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> Key Milestones
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveTab('milestones')}
                  className="text-xs text-primary hover:text-primary/80 h-7"
                >
                  View All →
                </Button>
              </CardHeader>
              <CardContent className="p-4 divide-y divide-border/70">
                {project.milestones && project.milestones.length > 0 ? (
                  project.milestones.map((m) => (
                    <div key={m.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{m.title || m.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString()}` : 'No due date'}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          m.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {m.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">No milestones defined yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Info Column */}
          <div className="space-y-6">
            <Card className="border-border/70 bg-card">
              <CardHeader className="pb-3 border-b border-border/70">
                <CardTitle className="text-sm font-semibold text-foreground">Project Attributes</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={statusColors[project.status]}>
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Priority</span>
                  <Badge variant="outline" className={priorityColors[project.priority]}>
                    {project.priority}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="text-foreground">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="text-foreground font-medium">
                    {deadline ? new Date(deadline).toLocaleDateString() : '—'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Manager</span>
                  <span className="text-foreground font-medium">
                    {project.projectManager?.name || 'Unassigned'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Time Tracking Mini Card */}
            <Card className="border-border/70 bg-card">
              <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Time Breakdown
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenLogTime(true)}
                  className="h-7 text-xs border-border/70"
                >
                  <Plus className="w-3 h-3 mr-1" /> Log Time
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billable Hours:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">{project.timeSummary?.billableHours || 0} hrs</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Non-billable Hours:</span>
                  <strong className="text-foreground">{project.timeSummary?.nonBillableHours || 0} hrs</strong>
                </div>
                <div className="flex justify-between pt-2 border-t border-border/70 font-semibold">
                  <span>Total Time:</span>
                  <span className="text-primary">{project.timeSummary?.totalHours || 0} hrs</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: MEMBERS */}
      {activeTab === 'members' && (
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Project Members ({project.members?.length || 0})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staff members authorized to view and execute tasks on this project
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenAddMember(true)}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Member
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/70">
                  <TableHead className="font-semibold text-foreground">Member</TableHead>
                  <TableHead className="font-semibold text-foreground">Email</TableHead>
                  <TableHead className="font-semibold text-foreground">Project Role</TableHead>
                  <TableHead className="font-semibold text-foreground">Added On</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.members && project.members.length > 0 ? (
                  project.members.map((m) => (
                    <TableRow key={m.userId} className="border-border/70">
                      <TableCell className="font-medium text-xs text-foreground flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                          {m.user?.name ? m.user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span>{m.user?.name || 'Unknown User'}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.user?.email || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-secondary text-foreground border-border/70"
                        >
                          {m.role || 'MEMBER'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(m.userId)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                      No members assigned to this project yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: MILESTONES */}
      {activeTab === 'milestones' && (
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Project Milestones ({project.milestones?.length || 0})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Structured phases and deliverables tracking milestone completion
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenAddMilestone(true)}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New Milestone
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/70">
                  <TableHead className="font-semibold text-foreground">Milestone Title</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Due Date</TableHead>
                  <TableHead className="font-semibold text-foreground">Tasks Linked</TableHead>
                  <TableHead className="font-semibold text-foreground">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.milestones && project.milestones.length > 0 ? (
                  project.milestones.map((m) => {
                    const totalT = m.tasks?.length || 0;
                    const doneT = m.tasks?.filter((t) => t.status === 'DONE').length || 0;
                    const prog = totalT > 0 ? Math.round((doneT / totalT) * 100) : m.status === 'COMPLETED' ? 100 : 0;
                    return (
                      <TableRow key={m.id} className="border-border/70">
                        <TableCell className="font-medium text-xs text-foreground">
                          <div>
                            <span className="font-semibold">{m.title || m.name}</span>
                            {m.description && (
                              <p className="text-[11px] text-muted-foreground">{m.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              m.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span>
                            <strong className="text-foreground">{doneT}</strong>/{totalT} Done
                          </span>
                        </TableCell>
                        <TableCell className="w-32">
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">{prog}%</span>
                            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${prog === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                                style={{ width: `${prog}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                      No milestones created yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: TASKS */}
      {activeTab === 'tasks' && (
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Project Tasks ({project.tasks?.length || 0})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Work items, assignees, priorities, and execution statuses
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenAddTask(true)}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New Task
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/70">
                  <TableHead className="font-semibold text-foreground">Task Title</TableHead>
                  <TableHead className="font-semibold text-foreground">Milestone</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground">Assignees</TableHead>
                  <TableHead className="font-semibold text-foreground">Due Date</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.tasks && project.tasks.length > 0 ? (
                  project.tasks.map((task) => (
                    <TableRow key={task.id} className="border-border/70 hover:bg-secondary/20">
                      <TableCell className="font-medium text-xs text-foreground">
                        <Link
                          href={`/work/tasks/${task.id}`}
                          className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                        >
                          {task.title}
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {task.milestone?.title || task.milestone?.name || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-secondary text-foreground"
                        >
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
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
                                className="w-6 h-6 rounded-full bg-primary/20 border border-card text-primary flex items-center justify-center text-[10px] font-bold"
                              >
                                {ta.user?.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                            ))
                          ) : (
                            <span className="italic text-muted-foreground/60">Unassigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
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
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      No tasks created for this project yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: TIME ENTRIES */}
      {activeTab === 'time' && (
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Time Logs ({project.timeEntries?.length || 0})
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total: <strong className="text-foreground">{project.timeSummary?.totalHours || 0} hrs</strong> (
                {project.timeSummary?.billableHours || 0} hrs billable)
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenLogTime(true)}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Log Time
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/70">
                  <TableHead className="font-semibold text-foreground">User</TableHead>
                  <TableHead className="font-semibold text-foreground">Task</TableHead>
                  <TableHead className="font-semibold text-foreground">Description</TableHead>
                  <TableHead className="font-semibold text-foreground">Duration</TableHead>
                  <TableHead className="font-semibold text-foreground">Billable</TableHead>
                  <TableHead className="font-semibold text-foreground">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.timeEntries && project.timeEntries.length > 0 ? (
                  project.timeEntries.map((te) => (
                    <TableRow key={te.id} className="border-border/70">
                      <TableCell className="font-medium text-xs text-foreground flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {te.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span>{te.user?.name || 'User'}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {te.task?.title || 'General Project Work'}
                      </TableCell>
                      <TableCell className="text-xs text-foreground max-w-xs truncate">
                        {te.description || '—'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {Math.round((te.minutes / 60) * 10) / 10} hrs ({te.minutes} min)
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            te.billable
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {te.billable ? 'Billable' : 'Non-billable'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(te.startedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      No time logged on this project yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* DIALOG: ADD MEMBER */}
      <Dialog surface open={openAddMember} onClose={() => setOpenAddMember(false)} className="max-w-md">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Add Project Member
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenAddMember(false)}
              className="text-muted-foreground"
            >
              ✕
            </Button>
          </div>

          {memberError && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
              {memberError}
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Select User *</label>
              <select
                required
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                className="w-full h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground"
              >
                <option value="">Choose team member</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Role in Project</label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className="w-full h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground"
              >
                <option value="MEMBER">Team Member</option>
                <option value="DEVELOPER">Developer / Engineer</option>
                <option value="DESIGNER">UI/UX Designer</option>
                <option value="LEAD">Technical Lead</option>
                <option value="PROJECT_MANAGER">Project Manager</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenAddMember(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={memberSubmitting}
              size="sm"
              className="text-xs bg-primary text-primary-foreground"
            >
              {memberSubmitting ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: ADD MILESTONE */}
      <Dialog surface open={openAddMilestone} onClose={() => setOpenAddMilestone(false)} className="max-w-md">
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> New Milestone
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenAddMilestone(false)}
              className="text-muted-foreground"
            >
              ✕
            </Button>
          </div>

          {milestoneError && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
              {milestoneError}
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Milestone Title *</label>
              <Input
                required
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="e.g. Sprint 1: Prototype Completion"
                className="bg-secondary border-border/70 text-foreground"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Target Due Date</label>
              <Input
                type="date"
                value={milestoneDueDate}
                onChange={(e) => setMilestoneDueDate(e.target.value)}
                className="bg-secondary border-border/70 text-foreground"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Description</label>
              <textarea
                rows={2}
                value={milestoneDescription}
                onChange={(e) => setMilestoneDescription(e.target.value)}
                placeholder="Scope & deliverable criteria"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border/70 text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenAddMilestone(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={milestoneSubmitting}
              size="sm"
              className="text-xs bg-primary text-primary-foreground"
            >
              {milestoneSubmitting ? 'Creating...' : 'Create Milestone'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: ADD TASK */}
      <Dialog surface open={openAddTask} onClose={() => setOpenAddTask(false)} className="max-w-lg">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" /> Create Task in {project.name}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenAddTask(false)}
              className="text-muted-foreground"
            >
              ✕
            </Button>
          </div>

          {taskError && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
              {taskError}
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Task Title *</label>
              <Input
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Implement OAuth SSO Flow"
                className="bg-secondary border-border/70 text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border/70 text-foreground"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Milestone (Optional)</label>
                <select
                  value={taskMilestoneId}
                  onChange={(e) => setTaskMilestoneId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border/70 text-foreground"
                >
                  <option value="">None / General</option>
                  {project.milestones?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title || m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Assignee</label>
                <select
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border/70 text-foreground"
                >
                  <option value="">Unassigned</option>
                  {project.members && project.members.length > 0 ? (
                    project.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user?.name || m.userId}
                      </option>
                    ))
                  ) : (
                    staffUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Due Date</label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Estimated Hours</label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 8"
                value={taskEstimatedHours}
                onChange={(e) => setTaskEstimatedHours(e.target.value)}
                className="bg-secondary border-border/70 text-foreground"
              />
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Description</label>
              <textarea
                rows={2}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Acceptance criteria or details..."
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border/70 text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenAddTask(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={taskSubmitting}
              size="sm"
              className="text-xs bg-primary text-primary-foreground"
            >
              {taskSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DIALOG: LOG TIME */}
      <Dialog surface open={openLogTime} onClose={() => setOpenLogTime(false)} className="max-w-md">
        <form onSubmit={handleLogTime} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Log Time on {project.name}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenLogTime(false)}
              className="text-muted-foreground"
            >
              ✕
            </Button>
          </div>

          {timeError && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
              {timeError}
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Associated Task</label>
              <select
                value={timeTaskId}
                onChange={(e) => setTimeTaskId(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-secondary border border-border/70 text-foreground"
              >
                <option value="">General Project Work (No specific task)</option>
                {project.tasks?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Duration (Minutes) *</label>
                <Input
                  required
                  type="number"
                  min="5"
                  step="5"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(e.target.value)}
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Billing Type</label>
                <div className="flex items-center gap-2 h-9 pt-1">
                  <input
                    type="checkbox"
                    id="billableCheck"
                    checked={timeBillable}
                    onChange={(e) => setTimeBillable(e.target.checked)}
                    className="w-4 h-4 rounded border-border/70 text-primary focus:ring-primary"
                  />
                  <label htmlFor="billableCheck" className="text-foreground cursor-pointer">
                    Billable to Customer
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Activity Description</label>
              <textarea
                rows={2}
                value={timeDescription}
                onChange={(e) => setTimeDescription(e.target.value)}
                placeholder="What work was completed during this period?"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border/70 text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenLogTime(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={timeSubmitting}
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {timeSubmitting ? 'Saving...' : 'Save Time Entry'}
            </Button>
          </div>
        </form>
      </Dialog>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Files</h2>
        <AttachmentsPanel entityType="project" entityId={projectId} />
      </section>
    </div>
  );
}
