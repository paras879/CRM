'use client';
import { AttachmentsPanel } from '@/components/ui/attachments-panel';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  LifeBuoy,
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  Calendar,
  Lock,
  MessageSquare,
  Send,
  Trash2,
  Paperclip,
  Check,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Ticket, TicketReply, TicketStatus, TicketPriority } from '@/types';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Conversation reply box state
  const [activeTab, setActiveTab] = useState<'REPLY' | 'NOTE'>('REPLY');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);

  const fetchTicket = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Support ticket not found or access denied.');
      }
      const json = await res.json();
      setTicket(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users?limit=100', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTicket();
    fetchUsers();
  }, [fetchTicket]);

  const handleUpdateStatus = async (newStatus: TicketStatus) => {
    if (!ticket) return;
    setUpdatingTicket(true);
    try {
      const res = await fetch(`/api/v1/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTicket();
      }
    } catch {
      // ignore
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleUpdatePriority = async (newPriority: TicketPriority) => {
    if (!ticket) return;
    setUpdatingTicket(true);
    try {
      const res = await fetch(`/api/v1/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        fetchTicket();
      }
    } catch {
      // ignore
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleReassign = async (newAssigneeId: string) => {
    if (!ticket) return;
    setUpdatingTicket(true);
    try {
      const res = await fetch(`/api/v1/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedTo: newAssigneeId || null }),
      });
      if (res.ok) {
        fetchTicket();
      }
    } catch {
      // ignore
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim() || !ticket) return;

    setSending(true);
    const isInternal = activeTab === 'NOTE';
    try {
      const payload: any = {
        body: messageBody.trim(),
        isInternal,
        attachmentUrls: attachmentUrl ? [attachmentUrl] : [],
      };

      const res = await fetch(`/api/v1/tickets/${ticket.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessageBody('');
        setAttachmentUrl('');
        fetchTicket();
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Are you sure you want to delete this message? This action is audited.') || !ticket) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/tickets/${ticket.id}/replies/${replyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchTicket();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="py-20 text-center max-w-md mx-auto">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Ticket Unavailable</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">{error || 'Ticket not found'}</p>
        <Button variant="outline" onClick={() => router.push('/support/tickets')}>
          Return to Support Desk
        </Button>
      </div>
    );
  }

  const now = new Date();
  const isSlaOverdue =
    ticket.status !== 'RESOLVED' &&
    ticket.status !== 'CLOSED' &&
    ((ticket.dueDate && new Date(ticket.dueDate) < now) || (ticket.slaDueAt && new Date(ticket.slaDueAt) < now));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Back Link & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/support/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Support Desk
        </Link>
        <div className="flex items-center gap-2">
          {ticket.status === 'RESOLVED' ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Ticket Resolved
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
              onClick={() => handleUpdateStatus('RESOLVED')}
              disabled={updatingTicket}
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Mark Resolved
            </Button>
          )}
        </div>
      </div>

      {/* SLA Alert Banner if overdue */}
      {isSlaOverdue && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span className="font-semibold">SLA OVERDUE NOTICE:</span>
            <span>This ticket has surpassed its target resolution deadline ({new Date(ticket.slaDueAt || ticket.dueDate!).toLocaleString()}).</span>
          </div>
          <span className="font-mono font-bold uppercase text-[11px] bg-red-600/10 px-2 py-0.5 rounded">High Priority Action</span>
        </div>
      )}

      {/* Ticket Details Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Subject, Description & Conversation Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info Card */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">
                  {ticket.ticketNumber}
                </span>
                <span className="text-xs text-muted-foreground">
                  Created {new Date(ticket.createdAt).toLocaleString()}
                </span>
              </div>
              <CardTitle className="text-xl font-bold mt-2 text-foreground">
                {ticket.subject}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-4 rounded-lg border border-border/40">
                {ticket.description}
              </div>

              {ticket.attachmentUrls && ticket.attachmentUrls.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {ticket.attachmentUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-xs text-foreground font-medium hover:bg-muted/80 border border-border"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation History & Internal Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Conversation History & Staff Notes ({ticket.replies?.length ?? 0})
            </h3>

            {ticket.replies && ticket.replies.length === 0 ? (
              <Card className="border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No replies or notes recorded yet. Be the first to reply below.
              </Card>
            ) : (
              ticket.replies?.map((r) => {
                const isInternal = r.isInternal;
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-4 transition-all text-xs ${
                      isInternal
                        ? 'bg-amber-500/[0.06] border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-700/40'
                        : 'bg-card border-border shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 border-b pb-2.5 mb-2.5 border-border/50">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            isInternal
                              ? 'bg-amber-500 text-white'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {r.author?.name ? r.author.name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">
                            {r.author?.name || 'Staff Member'}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-2">
                            {new Date(r.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isInternal ? (
                          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold gap-1">
                            <Lock className="h-2.5 w-2.5" /> Staff Internal Note
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Customer Visible
                          </Badge>
                        )}
                        <button
                          onClick={() => handleDeleteReply(r.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="text-foreground leading-relaxed whitespace-pre-wrap pl-9">
                      {r.body}
                    </div>

                    {r.attachmentUrls && r.attachmentUrls.length > 0 && (
                      <div className="pl-9 mt-3 flex flex-wrap gap-2">
                        {r.attachmentUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-muted/60 text-[11px] text-primary hover:underline"
                          >
                            <Paperclip className="h-3 w-3" /> File {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Reply Compose Card with Tab Toggle */}
          <Card className="border-border shadow-sm overflow-hidden">
            <div className="flex items-center border-b border-border bg-muted/40 px-3 pt-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('REPLY')}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'REPLY'
                    ? 'border-primary bg-card text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Customer Reply
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('NOTE')}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'NOTE'
                    ? 'border-amber-500 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300 font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Lock className="h-3.5 w-3.5" /> Internal Staff Note
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="p-4 space-y-3">
              {activeTab === 'NOTE' && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Staff Only: Internal notes are strictly protected and never exported or shared with customers.
                  </span>
                </div>
              )}

              <textarea
                required
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={
                  activeTab === 'NOTE'
                    ? 'Add internal investigation notes, reproduction steps, staff handoff details...'
                    : 'Type your message to the customer...'
                }
                className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex-1 max-w-sm">
                  <FileUploadField compact value={attachmentUrl} onChange={setAttachmentUrl} disabled={sending} />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={sending || !messageBody.trim()}
                  className={
                    activeTab === 'NOTE'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white gap-1.5'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5'
                  }
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending
                    ? 'Posting...'
                    : activeTab === 'NOTE'
                    ? 'Post Internal Note'
                    : 'Send Customer Reply'}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right Sidebar: Meta, Status, Priority & Assignment Controls */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold text-foreground">Ticket Properties</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Status Selector */}
              <div>
                <label className="text-muted-foreground font-semibold block mb-1.5">Status</label>
                <select
                  value={ticket.status}
                  onChange={(e) => handleUpdateStatus(e.target.value as TicketStatus)}
                  disabled={updatingTicket}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_ON_CUSTOMER">Waiting on Customer</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Priority Selector */}
              <div>
                <label className="text-muted-foreground font-semibold block mb-1.5">Priority</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => handleUpdatePriority(e.target.value as TicketPriority)}
                  disabled={updatingTicket}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent (SLA alert)</option>
                </select>
              </div>

              {/* Assignee Selector */}
              <div>
                <label className="text-muted-foreground font-semibold block mb-1.5">Assigned Agent</label>
                <select
                  value={ticket.assignedTo || ''}
                  onChange={(e) => handleReassign(e.target.value)}
                  disabled={updatingTicket}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-border/50 pt-3 space-y-2.5">
                {/* Customer */}
                <div>
                  <span className="text-muted-foreground block text-[11px]">Customer:</span>
                  {ticket.customer ? (
                    <Link
                      href={`/crm/customers`}
                      className="font-semibold text-primary hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Building2 className="h-3 w-3" /> {ticket.customer.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground italic">None associated</span>
                  )}
                </div>

                {/* Category */}
                <div>
                  <span className="text-muted-foreground block text-[11px]">Category:</span>
                  <span className="font-medium text-foreground">
                    {ticket.category ? ticket.category.name : 'General Support'}
                  </span>
                </div>

                {/* Department */}
                <div>
                  <span className="text-muted-foreground block text-[11px]">Department:</span>
                  <span className="font-medium text-foreground">
                    {ticket.department || 'Not specified'}
                  </span>
                </div>

                {/* SLA Deadline */}
                <div>
                  <span className="text-muted-foreground block text-[11px]">SLA Target Deadline:</span>
                  <div className={`mt-0.5 font-semibold ${isSlaOverdue ? 'text-red-600' : 'text-foreground'}`}>
                    {ticket.slaDueAt
                      ? new Date(ticket.slaDueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                      : 'None set'}
                  </div>
                </div>

                {/* Resolution Time */}
                {ticket.resolvedAt && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Resolved At:</span>
                    <span className="font-semibold text-emerald-600">
                      {new Date(ticket.resolvedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Files</h2>
        <AttachmentsPanel entityType="ticket" entityId={ticketId} />
      </section>
    </div>
  );
}
