'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { Role, Permission } from '@/types';
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
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Key,
  Users,
  Check,
} from 'lucide-react';

export default function RolesAdminPage() {
  const { hasPermission, user: currentUser } = useAuth();
  // Roles and permissions decide who can do what, so changing them is for Super Admins.
  const canManageRoles = hasPermission('roles.manage') && !!currentUser?.canManageAccess;
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsGrouped, setPermissionsGrouped] = useState<Record<string, Permission[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Form states
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch<{ roles: Role[] }>('/roles'),
        apiFetch<{ grouped: Record<string, Permission[]> }>('/permissions'),
      ]);
      setRoles(rolesRes.roles);
      setPermissionsGrouped(permsRes.grouped);
    } catch (err: any) {
      setError(err.message || 'Failed to load roles and permissions matrix');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await apiFetch('/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          permissionKeys: selectedPermissions,
        }),
      });
      setCreateModalOpen(false);
      setRoleName('');
      setRoleDescription('');
      setSelectedPermissions([]);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    if (!selectedRole) return;
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await apiFetch(`/roles/${selectedRole.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          permissionKeys: selectedPermissions,
        }),
      });
      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (r: Role) => {
    setSelectedRole(r);
    setRoleName(r.name);
    setRoleDescription(r.description || '');
    setSelectedPermissions(r.permissionKeys || []);
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleDeleteRole = async (r: Role) => {
    if (!confirm(`Are you sure you want to delete role "${r.name}"?`)) return;
    try {
      await apiFetch(`/roles/${r.id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete role');
    }
  };

  const togglePermission = (key: string) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter((k) => k !== key));
    } else {
      setSelectedPermissions([...selectedPermissions, key]);
    }
  };

  const toggleAllInModule = (modulePerms: Permission[]) => {
    const keys = modulePerms.map((p) => p.key);
    const allSelected = keys.every((k) => selectedPermissions.includes(k));

    if (allSelected) {
      setSelectedPermissions(selectedPermissions.filter((k) => !keys.includes(k)));
    } else {
      const merged = new Set([...selectedPermissions, ...keys]);
      setSelectedPermissions(Array.from(merged));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Roles & Permission Matrix
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure role definitions, assign permissions, and inspect authorization policies
          </p>
          {hasPermission('roles.manage') && !currentUser?.canManageAccess && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Only a Super Admin can change roles and permissions. You can view them here.
            </p>
          )}
        </div>
        {canManageRoles && (
          <Button
            onClick={() => {
              setRoleName('');
              setRoleDescription('');
              setSelectedPermissions([]);
              setFormError(null);
              setCreateModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Custom Role</span>
          </Button>
        )}
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Roles List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System and Custom Roles</CardTitle>
          <CardDescription>
            Roles bundle discrete permissions to enforce least privilege access
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Assigned Users</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : roles.length > 0 ? (
                roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>{r.name}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {r.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {r.permissionsCount ?? r.permissionKeys?.length ?? 0} perms
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.usersCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.isSystem ? 'secondary' : 'default'} className="text-[10px]">
                        {r.isSystem ? 'System' : 'Custom'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageRoles && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(r)}
                            className="h-8 px-2"
                            title="Edit permissions"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canManageRoles && !r.isSystem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRole(r)}
                            className="h-8 px-2 text-destructive hover:bg-destructive/10"
                            title="Delete role"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No roles found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Role Modal */}
      <Dialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Create Custom Role"
        description="Define a new role and select authorized capabilities"
        className="max-w-2xl"
      >
        {formError && <Alert variant="destructive" className="mb-4">{formError}</Alert>}
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Role Name"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Sales Representative"
            required
          />
          <Input
            label="Description"
            value={roleDescription}
            onChange={(e) => setRoleDescription(e.target.value)}
            placeholder="Brief explanation of authorized scope"
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Permissions Matrix</label>
              <span className="text-xs text-muted-foreground font-mono">
                {selectedPermissions.length} selected
              </span>
            </div>
            <div className="border border-border/80 rounded-lg p-3 max-h-72 overflow-y-auto space-y-4 bg-muted/10">
              {Object.entries(permissionsGrouped).map(([mod, perms]) => {
                const allSelected = perms.every((p) => selectedPermissions.includes(p.key));
                return (
                  <div key={mod} className="space-y-2">
                    <div className="flex items-center justify-between border-b border-border/50 pb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {mod}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAllInModule(perms)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {perms.map((p) => {
                        const isChecked = selectedPermissions.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => togglePermission(p.key)}
                            className={`flex items-start gap-2 p-1.5 rounded text-left text-xs transition-colors ${
                              isChecked
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-muted/30'
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-muted-foreground/40'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3" />}
                            </div>
                            <div className="truncate">
                              <span className="font-mono text-[11px] block">{p.key}</span>
                              <span className="text-[10px] text-muted-foreground truncate block">
                                {p.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
              Create Role
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title={`Edit Role: ${selectedRole?.name}`}
        description="Update permissions and role metadata"
        className="max-w-2xl"
      >
        {formError && <Alert variant="destructive" className="mb-4">{formError}</Alert>}
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Role Name"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            disabled={selectedRole?.name === 'Administrator'}
            required
          />
          <Input
            label="Description"
            value={roleDescription}
            onChange={(e) => setRoleDescription(e.target.value)}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Permissions Matrix</label>
              <span className="text-xs text-muted-foreground font-mono">
                {selectedPermissions.length} selected
              </span>
            </div>
            <div className="border border-border/80 rounded-lg p-3 max-h-72 overflow-y-auto space-y-4 bg-muted/10">
              {Object.entries(permissionsGrouped).map(([mod, perms]) => {
                const allSelected = perms.every((p) => selectedPermissions.includes(p.key));
                return (
                  <div key={mod} className="space-y-2">
                    <div className="flex items-center justify-between border-b border-border/50 pb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {mod}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAllInModule(perms)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {perms.map((p) => {
                        const isChecked = selectedPermissions.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => togglePermission(p.key)}
                            className={`flex items-start gap-2 p-1.5 rounded text-left text-xs transition-colors ${
                              isChecked
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-muted/30'
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-muted-foreground/40'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3" />}
                            </div>
                            <div className="truncate">
                              <span className="font-mono text-[11px] block">{p.key}</span>
                              <span className="text-[10px] text-muted-foreground truncate block">
                                {p.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
