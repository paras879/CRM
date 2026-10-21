'use client';
import { AttachmentsPanel } from '@/components/ui/attachments-panel';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { Lead, Activity, CustomerType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users,
  Building2,
  ArrowLeft,
  Mail,
  Phone,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = params.leadId as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'activities' | 'conversion'>('notes');

  // Convert Modal State
  const [openConvert, setOpenConvert] = useState(false);
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertType, setConvertType] = useState<CustomerType>('COMPANY');
  const [convertCustomerName, setConvertCustomerName] = useState('');
  const [convertContactName, setConvertContactName] = useState('');
  const [convertContactTitle, setConvertContactTitle] = useState('');
  const [convertTaxId, setConvertTaxId] = useState('');

  // Add Note State
  const [newNoteBody, setNewNoteBody] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Add Activity Modal
  const [openActivityModal, setOpenActivityModal] = useState(false);
  const [activitySubject, setActivitySubject] = useState('');
  const [activityType, setActivityType] = useState<'CALL' | 'MEETING' | 'TASK' | 'EMAIL' | 'FOLLOW_UP'>('FOLLOW_UP');
  const [activityDueDate, setActivityDueDate] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ lead: Lead }>(`/leads/${leadId}`);
      setLead(res.lead);
    } catch (err) {
      console.error('Failed to load lead details:', err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleOpenConvert = () => {
    if (!lead) return;
    setConvertType('COMPANY');
    setConvertCustomerName(lead.companyName || lead.name);
    setConvertContactName(lead.name);
    setConvertContactTitle('Primary Contact');
    setConvertTaxId('');
    setConvertError(null);
    setOpenConvert(true);
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setConvertError(null);

    try {
      setConvertSubmitting(true);
      await apiFetch(`/leads/${leadId}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          customerType: convertType,
          customerName: convertCustomerName.trim() || undefined,
          contactName: convertContactName.trim() || undefined,
          contactTitle: convertContactTitle.trim() || undefined,
          taxId: convertTaxId.trim() || undefined,
        }),
      });

      setOpenConvert(false);
      fetchLead();
    } catch (err) {
      if (err instanceof ApiError) {
        setConvertError(err.message);
      } else {
        setConvertError('Failed to convert lead.');
      }
    } finally {
      setConvertSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteBody.trim()) return;

    try {
      setNoteSubmitting(true);
      await apiFetch(`/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: newNoteBody.trim() }),
      });
      setNewNoteBody('');
      fetchLead();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activitySubject.trim()) return;

    try {
      setActivitySubmitting(true);
      await apiFetch('/activities', {
        method: 'POST',
        body: JSON.stringify({
          type: activityType,
          subject: activitySubject.trim(),
          leadId,
          dueDate: activityDueDate ? new Date(activityDueDate).toISOString() : undefined,
          description: activityDescription.trim() || undefined,
        }),
      });

      setOpenActivityModal(false);
      setActivitySubject('');
      setActivityDueDate('');
      setActivityDescription('');
      fetchLead();
    } catch (err) {
      console.error('Failed to create activity:', err);
    } finally {
      setActivitySubmitting(false);
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      await apiFetch(`/activities/${activityId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      fetchLead();
    } catch (err) {
      console.error('Failed to mark activity complete:', err);
    }
  };

  const formatCurrency = (val?: number | null, curr = 'INR') => {
    if (!val) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        Loading lead opportunity...
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-base font-semibold text-foreground">Lead record not found</h2>
        <p className="mt-1 text-xs text-muted-foreground">The requested lead does not exist.</p>
        <Link href="/crm/leads" className="mt-4 inline-block">
          <Button size="sm" variant="outline">
            Back to Leads Pipeline
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/crm/leads">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {lead.name}
              </h1>
              <Badge
                variant="secondary"
                className={`text-[10px] font-medium ${
                  lead.status === 'WON'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : lead.status === 'LOST'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    : lead.status === 'QUALIFIED'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {lead.status}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium ${
                  lead.priority === 'URGENT'
                    ? 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                    : lead.priority === 'HIGH'
                    ? 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                    : 'border-border/80 text-muted-foreground'
                }`}
              >
                {lead.priority}
              </Badge>
            </div>
            {lead.title && <p className="text-xs text-muted-foreground mt-0.5">{lead.title}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!lead.convertedToId ? (
            <Button
              size="sm"
              onClick={handleOpenConvert}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-sm"
            >
              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              Convert to Customer
            </Button>
          ) : (
            <Link href={`/crm/customers/${lead.convertedToId}`}>
              <Button size="sm" variant="outline" className="text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                View Converted Customer
              </Button>
            </Link>
          )}

          <Button
            size="sm"
            onClick={() => setOpenActivityModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Schedule Activity
          </Button>
        </div>
      </div>

      {/* Converted Alert Banner */}
      {lead.convertedToId && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              This lead was converted into customer{' '}
              <strong className="font-semibold text-emerald-200">{lead.convertedTo?.name || 'Customer'}</strong> on{' '}
              {lead.convertedAt ? new Date(lead.convertedAt).toLocaleDateString() : 'N/A'}.
            </span>
          </div>
          <Link href={`/crm/customers/${lead.convertedToId}`}>
            <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 bg-background/50 text-xs h-7">
              Go to Customer Profile
            </Button>
          </Link>
        </div>
      )}

      {/* Lead Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Deal Value */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Estimated Deal Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(lead.value, lead.currency)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Currency: <span className="font-medium text-foreground">{lead.currency}</span>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Lead Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-foreground/90">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <span className="truncate">{lead.email || 'No email provided'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <span>{lead.phone || 'No phone provided'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <span>{lead.companyName || 'No company specified'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Next Follow-up */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Next Follow-up</CardTitle>
          </CardHeader>
          <CardContent>
            {lead.nextFollowUp ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  {new Date(lead.nextFollowUp).toLocaleDateString()}
                </div>
                <div className="text-[11px]">
                  {new Date(lead.nextFollowUp).getTime() < Date.now() ? (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Overdue for client contact</span>
                  ) : (
                    <span className="text-muted-foreground">Upcoming engagement scheduled</span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/70 italic">No follow-up date assigned</span>
            )}
          </CardContent>
        </Card>

        {/* Lead Source & Owner */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ownership & Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-foreground/90">
            <div>
              Source: <span className="font-medium text-foreground">{lead.source || 'Direct / Unknown'}</span>
            </div>
            <div>
              Assigned To:{' '}
              <span className="font-medium text-foreground">
                {lead.owner?.name || 'Unassigned'}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground pt-0.5">
              Created: {new Date(lead.createdAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-border/80 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-2.5 transition-colors relative ${
              activeTab === 'notes'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Notes ({lead.notes?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`pb-2.5 transition-colors relative ${
              activeTab === 'activities'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Activities ({lead.activities?.length || 0})
          </button>
          {lead.convertedToId && (
            <button
              onClick={() => setActiveTab('conversion')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'conversion'
                  ? 'text-primary border-b-2 border-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Conversion Record
            </button>
          )}
        </div>

        {/* Tab Content: Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <Card className="border-border/70 bg-card">
              <CardContent className="p-4">
                <form onSubmit={handleAddNote} className="space-y-3">
                  <label className="text-xs font-semibold text-foreground block">
                    Add Interaction Note / Call Summary
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={newNoteBody}
                    onChange={(e) => setNewNoteBody(e.target.value)}
                    placeholder="Log prospect feedback, objections, decision makers, budget notes..."
                    className="w-full rounded-md border border-border/80 bg-background/50 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={noteSubmitting || !newNoteBody.trim()}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
                    >
                      {noteSubmitting ? 'Saving Note...' : 'Post Note'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {!lead.notes || lead.notes.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No notes recorded yet for this lead.
                </div>
              ) : (
                lead.notes.map((note) => (
                  <Card key={note.id} className="border-border/70 bg-card">
                    <CardContent className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {note.author?.name || 'Staff Member'}
                        </span>
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {note.body}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Activities */}
        {activeTab === 'activities' && (
          <Card className="border-border/70 bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/60">
                  <TableHead className="text-xs font-semibold text-foreground/80">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Subject</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Due Date</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Assigned To</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Status</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-foreground/80">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!lead.activities || lead.activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No follow-ups or activities scheduled for this lead.
                    </TableCell>
                  </TableRow>
                ) : (
                  lead.activities.map((act) => (
                    <TableRow key={act.id} className="border-border/50">
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-medium border-border/80">
                          {act.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {act.subject}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {act.dueDate ? new Date(act.dueDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {act.assignedTo?.name || 'Unassigned'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            act.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {act.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {act.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCompleteActivity(act.id)}
                            className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab Content: Conversion Details */}
        {activeTab === 'conversion' && lead.convertedTo && (
          <Card className="border-border/70 bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Conversion Provenance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                <div className="text-muted-foreground font-medium">Generated Customer Profile</div>
                <div className="text-sm font-semibold text-foreground">{lead.convertedTo.name}</div>
                <div className="text-muted-foreground">{lead.convertedTo.email || 'No email'}</div>
                <div className="pt-2">
                  <Link href={`/crm/customers/${lead.convertedToId}`}>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-border/80">
                      Open Customer Profile
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                <div className="text-muted-foreground font-medium">Primary Contact Generated</div>
                <div className="text-sm font-semibold text-foreground">
                  {lead.convertedContact?.name || lead.name}
                </div>
                <div className="text-muted-foreground">
                  Conversion Timestamp: {lead.convertedAt ? new Date(lead.convertedAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Convert Dialog */}
      <Dialog
        open={openConvert}
        onOpenChange={setOpenConvert}
        title="Convert Lead into Customer & Contact"
        description="Converts this lead opportunity into a permanent Customer account and primary Contact record."
        className="bg-card border-border text-foreground"
      >
        <form onSubmit={handleConvertLead} className="space-y-4">
          {convertError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{convertError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1.5">New Customer Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConvertType('COMPANY')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  convertType === 'COMPANY'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Company Account
              </button>
              <button
                type="button"
                onClick={() => setConvertType('INDIVIDUAL')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  convertType === 'INDIVIDUAL'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Users className="h-4 w-4" />
                Individual Client
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">
              Customer / Account Name *
            </label>
            <Input
              required
              value={convertCustomerName}
              onChange={(e) => setConvertCustomerName(e.target.value)}
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Primary Contact Name *
              </label>
              <Input
                required
                value={convertContactName}
                onChange={(e) => setConvertContactName(e.target.value)}
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Contact Job Title
              </label>
              <Input
                value={convertContactTitle}
                onChange={(e) => setConvertContactTitle(e.target.value)}
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Tax ID (Optional)</label>
            <Input
              value={convertTaxId}
              onChange={(e) => setConvertTaxId(e.target.value)}
              placeholder="e.g. GSTIN / VAT"
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenConvert(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={convertSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-sm"
            >
              {convertSubmitting ? 'Converting...' : 'Confirm Conversion'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Activity Dialog */}
      <Dialog
        open={openActivityModal}
        onOpenChange={setOpenActivityModal}
        title="Schedule Follow-up Activity"
        description="Book a task, meeting, or telephone follow-up for this lead."
        className="bg-card border-border text-foreground"
      >
        <form onSubmit={handleCreateActivity} className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Activity Type</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as any)}
              className="w-full h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="FOLLOW_UP">Follow-up Call / Touchpoint</option>
              <option value="MEETING">Meeting / Demo</option>
              <option value="CALL">Phone Discovery</option>
              <option value="EMAIL">Send Email / Proposal</option>
              <option value="TASK">Task / Internal Action</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Subject / Objective *</label>
            <Input
              required
              value={activitySubject}
              onChange={(e) => setActivitySubject(e.target.value)}
              placeholder="e.g. Discuss Q4 Pricing & Cloud Architecture"
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Due Date</label>
            <Input
              type="date"
              value={activityDueDate}
              onChange={(e) => setActivityDueDate(e.target.value)}
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              placeholder="Key talking points or agenda..."
              className="w-full rounded-md border border-border/80 bg-background/50 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenActivityModal(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={activitySubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
            >
              {activitySubmitting ? 'Scheduling...' : 'Save Activity'}
            </Button>
          </div>
        </form>
      </Dialog>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Files</h2>
        <AttachmentsPanel entityType="lead" entityId={leadId} />
      </section>
    </div>
  );
}
