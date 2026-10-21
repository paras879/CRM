'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { Activity, PaginatedResponse, ActivityType, ActivityStatus, Customer, Lead } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Clock,
  Plus,
  Building2,
  Users,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function ActivitiesPage() {
  const searchParams = useSearchParams();
  const initialTimeframe = searchParams.get('timeframe') || 'upcoming';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>(initialTimeframe);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Complete Modal State
  const [openCompleteModal, setOpenCompleteModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completing, setCompleting] = useState(false);

  // Reschedule Modal State
  const [openRescheduleModal, setOpenRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // New Activity Modal State
  const [openNewModal, setOpenNewModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newType, setNewType] = useState<ActivityType>('FOLLOW_UP');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [newSubmitting, setNewSubmitting] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        timeframe,
        sortBy: 'dueDate',
        sortOrder: timeframe === 'overdue' ? 'desc' : 'asc',
      });
      if (typeFilter) params.append('type', typeFilter);

      const res = await apiFetch<PaginatedResponse<Activity>>(`/activities?${params.toString()}`);
      setActivities(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
    }
  }, [page, timeframe, typeFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const loadRelationOptions = async () => {
    try {
      const [custRes, leadsRes] = await Promise.all([
        apiFetch<PaginatedResponse<Customer>>('/customers?limit=50&isArchived=false'),
        apiFetch<PaginatedResponse<Lead>>('/leads?limit=50&isArchived=false'),
      ]);
      setCustomersList(custRes.data);
      setLeadsList(leadsRes.data);
    } catch (err) {
      console.error('Failed to load relation options:', err);
    }
  };

  const handleOpenComplete = (act: Activity) => {
    setSelectedActivity(act);
    setCompletionNote('');
    setOpenCompleteModal(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;

    try {
      setCompleting(true);
      await apiFetch(`/activities/${selectedActivity.id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({
          completionNote: completionNote.trim() || undefined,
        }),
      });
      setOpenCompleteModal(false);
      fetchActivities();
    } catch (err) {
      console.error('Failed to mark complete:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleOpenReschedule = (act: Activity) => {
    setSelectedActivity(act);
    setRescheduleDate(act.dueDate ? new Date(act.dueDate).toISOString().split('T')[0] : '');
    setRescheduleReason('');
    setRescheduleError(null);
    setOpenRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    if (!rescheduleDate) {
      setRescheduleError('Please select a new due date.');
      return;
    }

    try {
      setRescheduling(true);
      await apiFetch(`/activities/${selectedActivity.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          newDueDate: new Date(rescheduleDate).toISOString(),
          reason: rescheduleReason.trim() || undefined,
        }),
      });
      setOpenRescheduleModal(false);
      fetchActivities();
    } catch (err) {
      if (err instanceof ApiError) {
        setRescheduleError(err.message);
      } else {
        setRescheduleError('Failed to reschedule activity.');
      }
    } finally {
      setRescheduling(false);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;

    try {
      setNewSubmitting(true);
      await apiFetch('/activities', {
        method: 'POST',
        body: JSON.stringify({
          type: newType,
          subject: newSubject.trim(),
          dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
          description: newDescription.trim() || undefined,
          customerId: selectedCustomerId || undefined,
          leadId: selectedLeadId || undefined,
        }),
      });

      setOpenNewModal(false);
      setNewSubject('');
      setNewDueDate('');
      setNewDescription('');
      setSelectedCustomerId('');
      setSelectedLeadId('');
      fetchActivities();
    } catch (err) {
      console.error('Failed to create activity:', err);
    } finally {
      setNewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Follow-ups & Activities</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Keep commitments on schedule across customer accounts and prospective leads.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              loadRelationOptions();
              setOpenNewModal(true);
            }}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Schedule Activity
          </Button>
        </div>
      </div>

      {/* Timeframe & Type Filter Bar */}
      <Card className="border-border/70 bg-card">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Timeframe Tabs */}
          <div className="flex items-center rounded-lg border border-border/80 bg-secondary/60 p-1 text-xs">
            {[
              { label: 'Upcoming', val: 'upcoming' },
              { label: 'Overdue', val: 'overdue' },
              { label: 'Completed', val: 'completed' },
              { label: 'All Activities', val: 'all' },
            ].map((t) => (
              <button
                key={t.val}
                type="button"
                onClick={() => {
                  setTimeframe(t.val);
                  setPage(1);
                }}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  timeframe === t.val
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Activity Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="CALL">Call</option>
              <option value="MEETING">Meeting</option>
              <option value="EMAIL">Email</option>
              <option value="TASK">Task</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card className="border-border/70 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow className="border-border/60">
              <TableHead className="text-xs font-semibold text-foreground/80">Type</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Subject</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Related Record</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Due Date</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Assigned To</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold text-foreground/80">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                  Loading activities schedule...
                </TableCell>
              </TableRow>
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                  No {timeframe} activities found.
                </TableCell>
              </TableRow>
            ) : (
              activities.map((act) => {
                const isOverdue = act.isOverdue;

                return (
                  <TableRow key={act.id} className="hover:bg-secondary/40 transition-colors border-border/50">
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium bg-secondary text-foreground/80 border-border/80"
                      >
                        {act.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{act.subject}</div>
                      {act.description && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                          {act.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {act.customer ? (
                        <Link
                          href={`/crm/customers/${act.customerId}`}
                          className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{act.customer.name}</span>
                        </Link>
                      ) : act.lead ? (
                        <Link
                          href={`/crm/leads/${act.leadId}`}
                          className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>{act.lead.name}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/70 italic">General / Internal</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {act.dueDate ? (
                        <div
                          className={`flex items-center gap-1 ${
                            isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground/80'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(act.dueDate).toLocaleDateString()}</span>
                          {isOverdue && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">(Overdue)</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/70 italic">No date</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {act.assignedTo?.name || <span className="text-muted-foreground/70 italic">Unassigned</span>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          act.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : isOverdue
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {act.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {act.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenComplete(act)}
                            className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Complete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReschedule(act)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Reschedule
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {act.completedAt ? `Done ${new Date(act.completedAt).toLocaleDateString()}` : 'Done'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing <strong className="font-semibold text-foreground">{activities.length}</strong> of{' '}
            <strong className="font-semibold text-foreground">{totalCount}</strong> activities
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs border-border/80"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
            <span className="px-2 font-medium text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs border-border/80"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Mark Complete Dialog */}
      <Dialog
        open={openCompleteModal}
        onOpenChange={setOpenCompleteModal}
        title="Complete Activity"
        description="Mark this commitment as successfully resolved and record completion notes."
        className="bg-card border-border text-foreground"
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          <div className="rounded-lg bg-secondary/50 p-3 text-xs text-foreground space-y-1 border border-border/80">
            <div className="font-semibold">{selectedActivity?.subject}</div>
            <div className="text-muted-foreground">
              {selectedActivity?.type} • Due: {selectedActivity?.dueDate ? new Date(selectedActivity.dueDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">
              Completion Summary / Call Outcome (Optional)
            </label>
            <textarea
              rows={3}
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="What was agreed or concluded during this interaction? Will automatically be added to account notes."
              className="w-full rounded-md border border-border/80 bg-background/50 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenCompleteModal(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={completing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-sm"
            >
              {completing ? 'Resolving...' : 'Mark Completed'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog
        open={openRescheduleModal}
        onOpenChange={setOpenRescheduleModal}
        title="Reschedule Follow-up"
        description="Select a revised due date for this client activity."
        className="bg-card border-border text-foreground"
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4">
          {rescheduleError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-300">
              {rescheduleError}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">New Target Date *</label>
            <Input
              type="date"
              required
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Reason for Rescheduling</label>
            <textarea
              rows={2}
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="e.g. Client requested postponement due to travel..."
              className="w-full rounded-md border border-border/80 bg-background/50 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenRescheduleModal(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={rescheduling}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
            >
              {rescheduling ? 'Saving...' : 'Update Date'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Schedule New Activity Dialog */}
      <Dialog
        open={openNewModal}
        onOpenChange={setOpenNewModal}
        title="Schedule Follow-up Activity"
        description="Book a task, meeting, or telephone touchpoint."
        className="bg-card border-border text-foreground"
      >
        <form onSubmit={handleCreateActivity} className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Activity Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="w-full h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="FOLLOW_UP">Follow-up Call / Touchpoint</option>
              <option value="MEETING">Meeting / Demo</option>
              <option value="CALL">Phone Discovery</option>
              <option value="EMAIL">Email Follow-up</option>
              <option value="TASK">Task / Internal Action</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Subject / Objective *</label>
            <Input
              required
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g. Discuss revised proposal & contract"
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Due Date</label>
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Link to Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  if (e.target.value) setSelectedLeadId('');
                }}
                className="w-full h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">None / Standalone</option>
                {customersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Link to Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => {
                  setSelectedLeadId(e.target.value);
                  if (e.target.value) setSelectedCustomerId('');
                }}
                className="w-full h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">None / Standalone</option>
                {leadsList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.companyName || 'No Company'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Talking points, deliverables or notes..."
              className="w-full rounded-md border border-border/80 bg-background/50 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenNewModal(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={newSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
            >
              {newSubmitting ? 'Saving...' : 'Create Activity'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
