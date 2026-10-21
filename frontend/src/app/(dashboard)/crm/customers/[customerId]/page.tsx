'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { Customer, Contact } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { AttachmentsPanel } from '@/components/ui/attachments-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Archive,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'contacts' | 'notes' | 'activities' | 'leads' | 'files'>('contacts');

  // Contact Modal
  const [openContactModal, setOpenContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // Note State
  const [newNoteBody, setNewNoteBody] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const fetchCustomer = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ customer: Customer }>(`/customers/${customerId}`);
      setCustomer(res.customer);
    } catch (err) {
      console.error('Failed to load customer:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);

    if (!contactName.trim()) {
      setContactError('Contact name is required.');
      return;
    }

    try {
      setContactSubmitting(true);
      const payload = {
        name: contactName.trim(),
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        title: contactTitle.trim() || null,
        isPrimary: contactIsPrimary,
      };

      if (editingContact) {
        await apiFetch(`/customers/${customerId}/contacts/${editingContact.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/customers/${customerId}/contacts`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setOpenContactModal(false);
      resetContactForm();
      fetchCustomer();
    } catch (err) {
      if (err instanceof ApiError) {
        setContactError(err.message);
      } else {
        setContactError('Failed to save contact.');
      }
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await apiFetch(`/customers/${customerId}/contacts/${contactId}`, {
        method: 'DELETE',
      });
      fetchCustomer();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteBody.trim()) return;

    try {
      setNoteSubmitting(true);
      await apiFetch(`/customers/${customerId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: newNoteBody.trim() }),
      });
      setNewNoteBody('');
      fetchCustomer();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setNoteSubmitting(false);
    }
  };

  const toggleArchive = async () => {
    if (!customer) return;
    try {
      const endpoint = customer.isArchived
        ? `/customers/${customer.id}/restore`
        : `/customers/${customer.id}/archive`;
      await apiFetch(endpoint, { method: 'PATCH' });
      fetchCustomer();
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  };

  const openNewContact = () => {
    resetContactForm();
    setOpenContactModal(true);
  };

  const openEditContact = (c: Contact) => {
    setEditingContact(c);
    setContactName(c.name);
    setContactEmail(c.email || '');
    setContactPhone(c.phone || '');
    setContactTitle(c.title || '');
    setContactIsPrimary(c.isPrimary);
    setContactError(null);
    setOpenContactModal(true);
  };

  const resetContactForm = () => {
    setEditingContact(null);
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setContactTitle('');
    setContactIsPrimary(false);
    setContactError(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        Loading customer record...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-base font-semibold text-foreground">Customer not found</h2>
        <p className="mt-1 text-xs text-muted-foreground">The requested customer record does not exist.</p>
        <Link href="/crm/customers" className="mt-4 inline-block">
          <Button size="sm" variant="outline">
            Back to Customers
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
          <Link href="/crm/customers">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {customer.name}
              </h1>
              <Badge
                variant="secondary"
                className={`text-[10px] font-medium ${
                  customer.type === 'COMPANY'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}
              >
                {customer.type}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-[10px] font-medium ${
                  customer.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {customer.status}
              </Badge>
              {customer.isArchived && (
                <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">
                  Archived
                </Badge>
              )}
            </div>
            {customer.companyName && customer.type === 'COMPANY' && (
              <p className="text-xs text-muted-foreground mt-0.5">{customer.companyName}</p>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={toggleArchive}
            className={`text-xs border-border/80 ${
              customer.isArchived
                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                : 'text-muted-foreground hover:text-rose-400'
            }`}
          >
            {customer.isArchived ? (
              <>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restore Account
              </>
            ) : (
              <>
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archive
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={openNewContact}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Customer Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Contact Info */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-foreground/90">
              <Mail className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <span className="truncate">{customer.email || 'No email provided'}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground/90">
              <Phone className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <span>{customer.phone || 'No phone provided'}</span>
            </div>
            {customer.website && (
              <div className="flex items-center gap-2 text-primary">
                <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href={customer.website} target="_blank" rel="noreferrer" className="truncate hover:underline">
                  {customer.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Address & Location */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Address & Tax Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-foreground/90">
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
              <div>
                <div>{customer.address || 'No street address'}</div>
                {(customer.city || customer.country) && (
                  <div className="text-muted-foreground">
                    {[customer.city, customer.state, customer.zipCode, customer.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>
            {customer.taxId && (
              <div className="pt-1 text-[11px] text-muted-foreground">
                Tax ID: <span className="font-medium text-foreground">{customer.taxId}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Manager */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Assigned Representative</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-foreground/90">
            {customer.assignedTo ? (
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                  {customer.assignedTo.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-foreground">{customer.assignedTo.name}</div>
                  <div className="text-[11px] text-muted-foreground">{customer.assignedTo.email}</div>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground/70 italic">Unassigned account</span>
            )}
          </CardContent>
        </Card>

        {/* Relationship Summary */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Account Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div>
              Created on:{' '}
              <span className="font-medium text-foreground">
                {new Date(customer.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              Total contacts:{' '}
              <span className="font-medium text-foreground">{customer.contacts?.length || 0}</span>
            </div>
            <div>
              Activities logged:{' '}
              <span className="font-medium text-foreground">{customer.activities?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-border/80 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`pb-2.5 transition-colors relative ${
              activeTab === 'contacts'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Contacts ({customer.contacts?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-2.5 transition-colors relative ${
              activeTab === 'notes'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Notes ({customer.notes?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`pb-2.5 transition-colors relative ${
              activeTab === 'activities'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Activities ({customer.activities?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-2.5 transition-colors relative ${
              activeTab === 'files'
                ? 'text-primary border-b-2 border-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Files
          </button>
          {customer.relatedLeads && customer.relatedLeads.length > 0 && (
            <button
              onClick={() => setActiveTab('leads')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'leads'
                  ? 'text-primary border-b-2 border-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Converted Lead ({customer.relatedLeads.length})
            </button>
          )}
        </div>

        {/* Tab Content: Contacts */}
        {activeTab === 'contacts' && (
          <Card className="border-border/70 bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/60">
                  <TableHead className="text-xs font-semibold text-foreground/80">Contact Name</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Title / Role</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Email</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Phone</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Primary Contact</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-foreground/80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!customer.contacts || customer.contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No contacts added yet. Click &quot;Add Contact&quot; to register key personnel.
                    </TableCell>
                  </TableRow>
                ) : (
                  customer.contacts.map((c) => (
                    <TableRow key={c.id} className="hover:bg-secondary/40 border-border/50">
                      <TableCell className="text-xs font-medium text-foreground">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.title || <span className="italic">Not set</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.email || <span className="italic">None</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.phone || <span className="italic">None</span>}
                      </TableCell>
                      <TableCell>
                        {c.isPrimary ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                            Primary Contact
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/70">Secondary</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditContact(c)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteContact(c.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab Content: Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <Card className="border-border/70 bg-card">
              <CardContent className="p-4">
                <form onSubmit={handleAddNote} className="space-y-3">
                  <label className="text-xs font-semibold text-foreground block">
                    Add Account Note / Meeting Minutes
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={newNoteBody}
                    onChange={(e) => setNewNoteBody(e.target.value)}
                    placeholder="Type notes, client conversation summaries, commitments..."
                    className="w-full rounded-md border border-border/80 bg-background/50 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={noteSubmitting || !newNoteBody.trim()}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    >
                      {noteSubmitting ? 'Saving Note...' : 'Post Note'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {!customer.notes || customer.notes.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No notes recorded yet for this customer.
                </div>
              ) : (
                customer.notes.map((note) => (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {!customer.activities || customer.activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No follow-ups or activities logged for this customer.
                    </TableCell>
                  </TableRow>
                ) : (
                  customer.activities.map((act) => (
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab Content: Converted Leads */}
        {activeTab === 'files' && <AttachmentsPanel entityType="customer" entityId={customerId} />}

        {activeTab === 'leads' && customer.relatedLeads && (
          <Card className="border-border/70 bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/40">
                <TableRow className="border-border/60">
                  <TableHead className="text-xs font-semibold text-foreground/80">Original Lead</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Company</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Value</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground/80">Converted At</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-foreground/80">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.relatedLeads.map((l) => (
                  <TableRow key={l.id} className="border-border/50">
                    <TableCell className="text-xs font-medium text-foreground">{l.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.companyName || 'N/A'}</TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {l.value ? `₹${l.value.toLocaleString()}` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.convertedAt ? new Date(l.convertedAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/crm/leads/${l.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/90">
                          View Lead
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Add / Edit Contact Dialog */}
      <Dialog
        open={openContactModal}
        onOpenChange={setOpenContactModal}
        title={editingContact ? 'Edit Contact Person' : 'Add New Contact Person'}
        description="Add points of contact associated with this customer account."
        className="bg-card border-border text-foreground"
      >
        <form onSubmit={handleSaveContact} className="space-y-3.5">
          {contactError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{contactError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Contact Name *</label>
            <Input
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Full name"
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Job Title / Designation</label>
            <Input
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              placeholder="e.g. Head of Procurement"
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Email Address</label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="name@company.com"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Direct Phone</label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone number"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPrimaryContact"
              checked={contactIsPrimary}
              onChange={(e) => setContactIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="isPrimaryContact" className="text-xs font-medium text-foreground/90">
              Set as primary contact for this account
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenContactModal(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={contactSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
            >
              {contactSubmitting ? 'Saving...' : editingContact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
