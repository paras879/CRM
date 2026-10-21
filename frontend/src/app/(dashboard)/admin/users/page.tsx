'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { User, Role, UserStatus, PaginatedResponse } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  UserPlus,
  Search,
  Edit2,
  UserX,
  UserCheck,
  Shield,
  RefreshCw,
  KeyRound,
  Copy,
} from 'lucide-react';

export default function UsersAdminPage() {
  const { hasPermission } = useAuth();
  const [resetLink, setResetLink] = useState<{ url: string; name: string; expiresAt: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleIssueReset = async (u: User) => {
    setResetError(null);
    setLinkCopied(false);
    try {
      const res = await apiFetch<{ data: { resetUrl: string; expiresAt: string; user: { name: string } } }>(
        `/users/${u.id}/password-reset`,
        { method: 'POST' }
      );
      setResetLink({ url: res.data.resetUrl, name: res.data.user.name, expiresAt: res.data.expiresAt });
    } catch (err: any) {
      setResetLink(null);
      setResetError(err.message || 'Failed to create a password reset link.');
    }
  };

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.url);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
    }
  };
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states for Create User
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userStatus, setUserStatus] = useState<UserStatus>('ACTIVE');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [managerId, setManagerId] = useState('');
  const [managerOptions, setManagerOptions] = useState<User[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await apiFetch<PaginatedResponse<User>>(`/users?${params.toString()}`);
      setUsers(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  const loadRoles = useCallback(async () => {
    try {
      const res = await apiFetch<{ roles: Role[] }>('/roles');
      setRoles(res.roles);
      if (res.roles.length > 0 && selectedRoleIds.length === 0) {
        setSelectedRoleIds([res.roles[0].id]);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  }, [selectedRoleIds.length]);

  const loadManagerOptions = useCallback(async () => {
    try {
      const res = await apiFetch<PaginatedResponse<User>>('/users?status=ACTIVE&limit=100');
      setManagerOptions(res.data);
    } catch (err) {
      console.error('Failed to load managers:', err);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  useEffect(() => {
    loadManagerOptions();
  }, [loadManagerOptions]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          status: userStatus,
          roleIds: selectedRoleIds,
          managerId: managerId || null,
        }),
      });
      setCreateModalOpen(false);
      setManagerId('');
      setName('');
      setEmail('');
      setPassword('');
      loadUsers();
      loadManagerOptions();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    if (!selectedUser) return;
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const body: any = {
        name,
        email,
        status: userStatus,
        roleIds: selectedRoleIds,
        managerId: managerId || null,
      };
      if (password) body.password = password;

      await apiFetch(`/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setEditModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setUserStatus(u.status);
    const existingRoleIds = Array.isArray(u.roles)
      ? u.roles.map((r: any) => (typeof r === 'string' ? r : r.id))
      : [];
    setSelectedRoleIds(existingRoleIds);
    setManagerId(u.managerId ?? '');
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleToggleStatus = async (u: User) => {
    const nextStatus = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await apiFetch(`/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to change user status');
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    if (selectedRoleIds.includes(roleId)) {
      if (selectedRoleIds.length === 1) return; // Keep at least one
      setSelectedRoleIds(selectedRoleIds.filter((id) => id !== roleId));
    } else {
      setSelectedRoleIds([...selectedRoleIds, roleId]);
    }
  };

  const renderManagerSelect = (excludeUserId?: string) => (
    <div>
      <label className="text-sm font-medium block mb-1">Reports To</label>
      <select
        value={managerId}
        onChange={(e) => setManagerId(e.target.value)}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
      >
        <option value="">No manager</option>
        {managerOptions
          .filter((m) => m.id !== excludeUserId)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
      </select>
      <p className="text-xs text-muted-foreground mt-1">
        Managers see the dashboard and reports for the people who report to them.
      </p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Staff & User Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage company users, system access, credentials, and role assignments
          </p>
        </div>
        {hasPermission('users.create') && (
          <Button
            onClick={() => {
              setManagerId('');
              setCreateModalOpen(true);
            }}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create New User</span>
          </Button>
        )}
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 py-1.5 text-xs rounded-md border border-input bg-background text-foreground"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INVITED">Invited</option>
                <option value="DISABLED">Disabled</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsers}
                disabled={isLoading}
                title="Refresh list"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Reports To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users.length > 0 ? (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground text-sm">{u.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(u.roles) && u.roles.length > 0 ? (
                          u.roles.map((r: any) => (
                            <Badge key={typeof r === 'string' ? r : r.id} variant="secondary" className="text-[10px]">
                              {typeof r === 'string' ? r : r.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.manager?.name ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.status === 'ACTIVE'
                            ? 'success'
                            : u.status === 'INVITED'
                            ? 'warning'
                            : 'destructive'
                        }
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(u.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasPermission('users.update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(u)}
                            className="h-8 px-2"
                            title="Edit user"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {hasPermission('users.update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleIssueReset(u)}
                            className="h-8 px-2"
                            title="Create password reset link"
                            aria-label={`Create password reset link for ${u.name}`}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {hasPermission('users.delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(u)}
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            title={u.status === 'ACTIVE' ? 'Deactivate user' : 'Activate user'}
                          >
                            {u.status === 'ACTIVE' ? (
                              <UserX className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users matching criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Dialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Create New Staff User"
        description="Add a staff user with role-based access permissions"
      >
        {formError && <Alert variant="destructive" className="mb-4">{formError}</Alert>}
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
          />
          <Input
            label="Corporate Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
          />
          <Input
            label="Temporary Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            required
          />
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value as UserStatus)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INVITED">INVITED</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </div>
          {renderManagerSelect()}
          <div>
            <label className="text-sm font-medium block mb-2">Assign Roles</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
              {roles.map((r) => {
                const isSelected = selectedRoleIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRoleSelection(r.id)}
                    className={`flex items-center gap-2 p-2 rounded-md border text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Shield className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create User
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Password Reset Link Modal */}
      <Dialog
        open={!!resetLink || !!resetError}
        onOpenChange={(open) => {
          if (!open) {
            setResetLink(null);
            setResetError(null);
          }
        }}
        title="Password reset link"
        description={resetLink ? `Share this one-time link with ${resetLink.name}. It is shown only once.` : undefined}
      >
        {resetError && <Alert variant="destructive">{resetError}</Alert>}
        {resetLink && (
          <div className="space-y-3">
            <Input label="Reset link" value={resetLink.url} readOnly onFocus={(e) => e.currentTarget.select()} />
            <p className="text-xs text-muted-foreground">
              Expires {new Date(resetLink.expiresAt).toLocaleString()}. Creating another link invalidates this one.
            </p>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={copyResetLink} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> {linkCopied ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Edit User Modal */}
      <Dialog
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Edit Staff Member"
        description="Update profile, status and role permissions"
      >
        {formError && <Alert variant="destructive" className="mb-4">{formError}</Alert>}
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Corporate Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Reset Password (optional)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep existing password"
          />
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value as UserStatus)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INVITED">INVITED</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </div>
          {renderManagerSelect(selectedUser?.id)}
          <div>
            <label className="text-sm font-medium block mb-2">Assigned Roles</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
              {roles.map((r) => {
                const isSelected = selectedRoleIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRoleSelection(r.id)}
                    className={`flex items-center gap-2 p-2 rounded-md border text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Shield className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
