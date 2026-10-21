'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { Customer, PaginatedResponse, CustomerType, CustomerStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2,
  User,
  Plus,
  Search,
  Archive,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  AlertCircle,
} from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isArchived, setIsArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create Modal State
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formType, setFormType] = useState<CustomerType>('COMPANY');
  const [formName, setFormName] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formTaxId, setFormTaxId] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formZipCode, setFormZipCode] = useState('');
  // Contact
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [initialNote, setInitialNote] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        isArchived: isArchived.toString(),
      });
      if (search.trim()) params.append('search', search.trim());
      if (typeFilter) params.append('type', typeFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await apiFetch<PaginatedResponse<Customer>>(`/customers?${params.toString()}`);
      setCustomers(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  }, [page, isArchived, search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formName.trim()) {
      setCreateError('Customer name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        type: formType,
        name: formName.trim(),
        companyName: formType === 'COMPANY' ? (formCompanyName.trim() || formName.trim()) : undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        website: formWebsite.trim() || undefined,
        taxId: formTaxId.trim() || undefined,
        address: formAddress.trim() || undefined,
        city: formCity.trim() || undefined,
        state: formState.trim() || undefined,
        country: formCountry.trim() || undefined,
        zipCode: formZipCode.trim() || undefined,
      };

      if (contactName.trim()) {
        payload.initialContact = {
          name: contactName.trim(),
          email: contactEmail.trim() || undefined,
          phone: contactPhone.trim() || undefined,
          title: contactTitle.trim() || undefined,
          isPrimary: true,
        };
      }

      if (initialNote.trim()) {
        payload.initialNote = initialNote.trim();
      }

      await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setOpenCreate(false);
      resetForm();
      fetchCustomers();
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(err.message);
      } else {
        setCreateError('Failed to create customer. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormType('COMPANY');
    setFormName('');
    setFormCompanyName('');
    setFormEmail('');
    setFormPhone('');
    setFormWebsite('');
    setFormTaxId('');
    setFormAddress('');
    setFormCity('');
    setFormState('');
    setFormCountry('');
    setFormZipCode('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setContactTitle('');
    setInitialNote('');
    setCreateError(null);
  };

  const toggleArchive = async (customer: Customer) => {
    try {
      const endpoint = customer.isArchived
        ? `/customers/${customer.id}/restore`
        : `/customers/${customer.id}/archive`;
      await apiFetch(endpoint, { method: 'PATCH' });
      fetchCustomers();
    } catch (err) {
      console.error('Failed to toggle archive status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Directory of enterprise accounts, individual clients, and contact relationships.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportMenu type="customers-table" />
          <Button
            onClick={() => {
              resetForm();
              setOpenCreate(true);
            }}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Customer
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/70 bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, email, phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              {/* Active vs Archived Toggle */}
              <div className="flex items-center rounded-md border border-border/80 bg-secondary/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsArchived(false);
                    setPage(1);
                  }}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    !isArchived ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsArchived(true);
                    setPage(1);
                  }}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    isArchived ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Archived
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Data Table */}
      <Card className="border-border/70 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow className="border-border/60">
              <TableHead className="text-xs font-semibold text-foreground/80">Customer</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Type</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Primary Contact</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Contacts</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Assigned To</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold text-foreground/80">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                  Loading customers directory...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                  No customers found matching the criteria.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-secondary/40 transition-colors border-border/50">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        {customer.type === 'COMPANY' ? (
                          <Building2 className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/crm/customers/${customer.id}`}
                          className="text-xs font-medium text-foreground hover:text-primary block truncate"
                        >
                          {customer.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground/70" />
                              {customer.email}
                            </span>
                          )}
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground/70" />
                              {customer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-xs text-foreground/90">
                    {customer.primaryContact ? (
                      <div>
                        <div className="font-medium text-foreground">
                          {customer.primaryContact.name}
                        </div>
                        {customer.primaryContact.title && (
                          <div className="text-[11px] text-muted-foreground">
                            {customer.primaryContact.title}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/70 italic">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-foreground/80">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground/90">
                      {customer.contactsCount ?? (customer.contacts?.length || 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {customer.assignedTo?.name || <span className="text-muted-foreground/70 italic">Unassigned</span>}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/crm/customers/${customer.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary/90">
                          Details
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleArchive(customer)}
                        className={`h-7 px-2 text-xs ${
                          customer.isArchived
                            ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-300'
                            : 'text-muted-foreground hover:text-rose-400'
                        }`}
                      >
                        {customer.isArchived ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-3.5 w-3.5 mr-1" />
                            Archive
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing <strong className="font-semibold text-foreground">{customers.length}</strong> of{' '}
            <strong className="font-semibold text-foreground">{totalCount}</strong> customers
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

      {/* New Customer Dialog */}
      <Dialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        title="Create New Customer"
        description="Add a company account or individual client to your CRM database."
        className="max-w-2xl bg-card border-border text-foreground"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          {createError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1.5">Customer Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormType('COMPANY')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  formType === 'COMPANY'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Company Account
              </button>
              <button
                type="button"
                onClick={() => setFormType('INDIVIDUAL')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  formType === 'INDIVIDUAL'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <User className="h-4 w-4" />
                Individual Client
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                {formType === 'COMPANY' ? 'Account / Client Name *' : 'Full Name *'}
              </label>
              <Input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={formType === 'COMPANY' ? 'Company name' : 'Full name'}
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>

            {formType === 'COMPANY' && (
              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1">
                  Official Entity Name
                </label>
                <Input
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                  placeholder="Registered company name"
                  className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Primary Email</label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="name@company.com"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Phone Number</label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="Phone number"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Website</label>
              <Input
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Tax Identifier (GSTIN / VAT / EIN)
              </label>
              <Input
                value={formTaxId}
                onChange={(e) => setFormTaxId(e.target.value)}
                placeholder="e.g. 29ABCDE1234F1Z5"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
            <div className="col-span-2 sm:col-span-2">
              <label className="text-xs font-medium text-foreground/80 block mb-1">Street Address</label>
              <Input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Suite 500, Cyber Tech Park"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">City</label>
              <Input
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Bangalore"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Country</label>
              <Input
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                placeholder="India"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
          </div>

          {formType === 'COMPANY' && (
            <div className="rounded-lg border border-border/80 bg-secondary/30 p-3 space-y-3">
              <div className="text-xs font-semibold text-foreground">Primary Contact Person (Optional)</div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact Name"
                  className="text-xs h-8 bg-background/60 border-border/80 text-foreground"
                />
                <Input
                  value={contactTitle}
                  onChange={(e) => setContactTitle(e.target.value)}
                  placeholder="Job Title / Designation"
                  className="text-xs h-8 bg-background/60 border-border/80 text-foreground"
                />
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Contact Direct Email"
                  className="text-xs h-8 bg-background/60 border-border/80 text-foreground"
                />
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Contact Direct Mobile"
                  className="text-xs h-8 bg-background/60 border-border/80 text-foreground"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Initial Account Note (Optional)</label>
            <textarea
              rows={2}
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="Background context, payment terms or account notes..."
              className="w-full rounded-md border border-border/80 bg-background/50 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="sticky -bottom-6 -mx-6 bg-card/95 backdrop-blur-md px-6 py-3.5 border-t border-border/70 flex items-center justify-end gap-2 z-10 mt-6 shadow-lg">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenCreate(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
            >
              {submitting ? 'Creating Customer...' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
