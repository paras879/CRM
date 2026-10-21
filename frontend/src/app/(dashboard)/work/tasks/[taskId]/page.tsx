'use client';
import { AttachmentsPanel } from '@/components/ui/attachments-panel';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { Task, TaskComment, TimeEntry, TaskStatus, TaskPriority } from '@/types';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CheckSquare,
  Calendar,
  Clock,
  ArrowLeft,
  AlertCircle,
  FolderKanban,
  User,
  MessageSquare,
  Trash2,
  Plus,
  Send,
  Layers,
  CheckCircle2,
} from 'lucide-react';

const priorityColors: Record<TaskPriority, string> = {
  LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  MEDIUM: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  HIGH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  URGENT: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  // Comment state
  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Log Time dialog
  const [openLogTime, setOpenLogTime] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState('60');
  const [timeDescription, setTimeDescription] = useState('');
  const [timeBillable, setTimeBillable] = useState(true);
  const [timeSubmitting, setTimeSubmitting] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  const fetchTaskDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ task: Task }>(`/tasks/${taskId}`);
      setTask(res.task);
    } catch (err) {
      console.error('Failed to fetch task:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      await apiFetch(`/tasks/${task.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTaskDetails();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    setCommentError(null);

    try {
      await apiFetch(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      setCommentBody('');
      fetchTaskDetails();
    } catch (err: any) {
      setCommentError(err.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await apiFetch(`/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      fetchTaskDetails();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setTimeSubmitting(true);
    setTimeError(null);

    try {
      const minutes = parseInt(timeMinutes, 10) || 60;
      await apiFetch('/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          projectId: task.projectId,
          taskId: task.id,
          startedAt: new Date(Date.now() - minutes * 60000).toISOString(),
          endedAt: new Date().toISOString(),
          minutes,
          description: timeDescription.trim() || undefined,
          billable: timeBillable,
        }),
      });
      setOpenLogTime(false);
      setTimeDescription('');
      setTimeMinutes('60');
      fetchTaskDetails();
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
        <p className="text-sm text-muted-foreground">Loading task details...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Task Not Found</h2>
        <p className="text-sm text-muted-foreground">The requested task does not exist or has been removed.</p>
        <Link href="/work/tasks">
          <Button variant="outline" className="border-border/70 text-foreground">
            Back to Tasks
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/work/tasks">
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
                {task.title}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0.5 rounded font-medium ${priorityColors[task.priority]}`}
              >
                {task.priority}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {task.project && (
                <Link
                  href={`/work/projects/${task.project.id}`}
                  className="text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  {task.project.name}
                </Link>
              )}
              {task.milestone && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  {task.milestone.title || task.milestone.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Status Select */}
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>

          <Button
            size="sm"
            onClick={() => setOpenLogTime(true)}
            className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" /> Log Time
          </Button>
        </div>
      </div>

      {/* Main Grid: Details + Discussion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Description & Comments Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3 border-b border-border/70">
              <CardTitle className="text-sm font-semibold text-foreground">Task Description</CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs text-foreground leading-relaxed">
              {task.description ? (
                <p className="whitespace-pre-line">{task.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description provided for this task.</p>
              )}
            </CardContent>
          </Card>

          {/* Time Tracking on this Task */}
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Tracked Time Entries
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total logged: <strong className="text-foreground">{task.totalTrackedHours || 0} hrs</strong> (
                  {task.totalTrackedMinutes || 0} min)
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenLogTime(true)}
                className="h-7 text-xs border-border/70"
              >
                <Plus className="w-3 h-3 mr-1" /> Log Time
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow className="border-border/70">
                    <TableHead className="font-semibold text-foreground">User</TableHead>
                    <TableHead className="font-semibold text-foreground">Duration</TableHead>
                    <TableHead className="font-semibold text-foreground">Description</TableHead>
                    <TableHead className="font-semibold text-foreground">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {task.timeEntries && task.timeEntries.length > 0 ? (
                    task.timeEntries.map((te) => (
                      <TableRow key={te.id} className="border-border/70">
                        <TableCell className="text-xs text-foreground font-medium">
                          {te.user?.name || 'Staff User'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {Math.round((te.minutes / 60) * 10) / 10} hrs ({te.minutes} min)
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {te.description || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(te.startedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs italic">
                        No time logged on this task yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Comments & Activity Timeline */}
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3 border-b border-border/70">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Task Discussion & Comments (
                {task.comments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* New Comment Input */}
              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea
                  rows={2}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Leave a comment, progress note, or question..."
                  className="w-full px-3 py-2 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {commentError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{commentError}</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={submittingComment || !commentBody.trim()}
                    size="sm"
                    className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </Button>
                </div>
              </form>

              {/* Comments List */}
              <div className="divide-y divide-border/70 pt-2">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.map((comment) => (
                    <div key={comment.id} className="py-3 first:pt-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                            {comment.author?.name ? comment.author.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="text-xs font-semibold text-foreground">
                            {comment.author?.name || 'User'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Delete comment */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-foreground pl-8 whitespace-pre-line">{comment.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    No comments yet. Start the conversation!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Metadata & Assignees */}
        <div className="space-y-6">
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3 border-b border-border/70">
              <CardTitle className="text-sm font-semibold text-foreground">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="bg-secondary text-foreground font-medium">
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Priority</span>
                <Badge variant="outline" className={priorityColors[task.priority]}>
                  {task.priority}
                </Badge>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Due Date</span>
                <span
                  className={`font-medium ${
                    task.isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'
                  }`}
                >
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Estimated Time</span>
                <span className="text-foreground">
                  {task.estimatedHours ? `${task.estimatedHours} hrs` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Tracked Time</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {task.totalTrackedHours || 0} hrs
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Completed At</span>
                <span className="text-foreground">
                  {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Created By</span>
                <span className="text-foreground font-medium">
                  {task.creator?.name || 'System'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Assignees Card */}
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3 border-b border-border/70">
              <CardTitle className="text-sm font-semibold text-foreground">
                Assignees ({task.assignees?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.map((ta) => (
                  <div key={ta.userId} className="flex items-center gap-2.5 py-1">
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                      {ta.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{ta.user?.name || 'User'}</p>
                      <p className="text-[10px] text-muted-foreground">{ta.user?.email || ''}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No assignees on this task.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DIALOG: LOG TIME */}
      <Dialog surface open={openLogTime} onClose={() => setOpenLogTime(false)} className="max-w-md">
        <form onSubmit={handleLogTime} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Log Time on Task
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
                    id="taskBillableCheck"
                    checked={timeBillable}
                    onChange={(e) => setTimeBillable(e.target.checked)}
                    className="w-4 h-4 rounded border-border/70 text-primary"
                  />
                  <label htmlFor="taskBillableCheck" className="text-foreground cursor-pointer">
                    Billable Time
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
                placeholder="Work done..."
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
              {timeSubmitting ? 'Saving...' : 'Save Time'}
            </Button>
          </div>
        </form>
      </Dialog>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Files</h2>
        <AttachmentsPanel entityType="task" entityId={taskId} />
      </section>
    </div>
  );
}
