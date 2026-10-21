'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { Project, Customer, User, ProjectStatus, TaskPriority } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Briefcase,
  Plus,
  Search,
  Archive,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Users,
  Layers,
  Filter,
} from 'lucide-react';

interface PaginatedProjectsResponse {
  data: Project[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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

import { useSearchParams } from 'next/navigation';

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status');

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || '');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [isArchived, setIsArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create Project Modal State
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('PLANNING');
  const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formCurrency, setFormCurrency] = useState('INR');
  const [formManagerId, setFormManagerId] = useState('');

  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const [custRes, usersRes] = await Promise.allSettled([
        apiFetch<any>('/customers?limit=100'),
        apiFetch<any>('/users?limit=100'),
      ]);
      if (custRes.status === 'fulfilled') {
        setCustomers(custRes.value.data || custRes.value.customers || []);
      }
      if (usersRes.status === 'fulfilled') {
        setStaffUsers(usersRes.value.data || usersRes.value.users || []);
      }
    } catch (e) {
      console.error('Error fetching aux data', e);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        isArchived: isArchived.toString(),
      });
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);

      const res = await apiFetch<PaginatedProjectsResponse>(`/projects?${params.toString()}`);
      setProjects(res.data || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalCount(res.meta?.total || (res.data ? res.data.length : 0));
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, [page, isArchived, search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSubmitting(true);

    try {
      if (!formName.trim()) {
        throw new Error('Project name is required');
      }

      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          customerId: formCustomerId || undefined,
          status: formStatus,
          priority: formPriority,
          startDate: formStartDate ? new Date(formStartDate).toISOString() : undefined,
          deadline: formDeadline ? new Date(formDeadline).toISOString() : undefined,
          budget: formBudget ? parseFloat(formBudget) : undefined,
          currency: formCurrency || 'INR',
          projectManagerId: formManagerId || undefined,
        }),
      });

      setOpenCreate(false);
      resetForm();
      fetchProjects();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setCreateError(err.message || 'Validation error');
      } else {
        setCreateError(err.message || 'Failed to create project');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCustomerId('');
    setFormStatus('PLANNING');
    setFormPriority('MEDIUM');
    setFormStartDate('');
    setFormDeadline('');
    setFormBudget('');
    setFormCurrency('INR');
    setFormManagerId('');
    setCreateError(null);
  };

  const handleArchiveToggle = async (project: Project) => {
    try {
      const endpoint = project.isArchived
        ? `/projects/${project.id}/restore`
        : `/projects/${project.id}/archive`;
      await apiFetch(endpoint, { method: 'PATCH' });
      fetchProjects();
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  };

  // KPI Calculations
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;
  const planningCount = projects.filter((p) => p.status === 'PLANNING').length;
  const completedCount = projects.filter((p) => p.status === 'COMPLETED').length;
  const highPriorityCount = projects.filter(
    (p) => p.priority === 'HIGH' || p.priority === 'URGENT'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Project Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track enterprise deliverables, customer engagements, milestones, and tracked hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu type="projects-table" />
          <Button
            onClick={() => setOpenCreate(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* KPI Cards (Interactive & Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => {
            setStatusFilter(statusFilter === 'ACTIVE' ? '' : 'ACTIVE');
            setPriorityFilter('');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            statusFilter === 'ACTIVE' ? 'ring-2 ring-primary border-primary bg-primary/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Projects
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : activeCount}
              </h3>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Filter by Active
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Briefcase className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setStatusFilter(statusFilter === 'PLANNING' ? '' : 'PLANNING');
            setPriorityFilter('');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            statusFilter === 'PLANNING' ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-500/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                In Planning
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : planningCount}
              </h3>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Pipeline initiatives
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setStatusFilter(statusFilter === 'COMPLETED' ? '' : 'COMPLETED');
            setPriorityFilter('');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            statusFilter === 'COMPLETED' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : completedCount}
              </h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Successfully delivered
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setPriorityFilter(priorityFilter === 'HIGH' ? '' : 'HIGH');
            setStatusFilter('');
            setPage(1);
          }}
          className={`cursor-pointer transition-all duration-200 border-border/70 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg ${
            priorityFilter === 'HIGH' ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/5' : 'bg-card'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                High Priority
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {loading ? '...' : highPriorityCount}
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Urgent & high focus
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-5 h-5" />
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
              placeholder="Search projects or descriptions..."
              className="pl-9 bg-secondary border-border/70 text-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
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

            {/* Archive Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsArchived(!isArchived);
                setPage(1);
              }}
              className={`border-border/70 text-xs gap-1.5 ${
                isArchived ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'text-foreground'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              {isArchived ? 'Archived Projects' : 'Active View'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card className="border-border/70 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow className="border-border/70 hover:bg-transparent">
                <TableHead className="font-semibold text-foreground">Project Name</TableHead>
                <TableHead className="font-semibold text-foreground">Customer</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Priority</TableHead>
                <TableHead className="font-semibold text-foreground">Progress</TableHead>
                <TableHead className="font-semibold text-foreground">Tasks</TableHead>
                <TableHead className="font-semibold text-foreground">Deadline</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading projects...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Briefcase className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-foreground">No projects found</p>
                      <p className="text-xs text-muted-foreground">
                        {search || statusFilter || priorityFilter
                          ? 'Try adjusting your filters or search terms'
                          : 'Get started by creating your first project'}
                      </p>
                      {!isArchived && (
                        <Button
                          size="sm"
                          onClick={() => setOpenCreate(true)}
                          className="mt-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Create Project
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => {
                  const deadlineDate = project.deadline || project.dueDate;
                  const isOverdue =
                    deadlineDate &&
                    new Date(deadlineDate) < new Date() &&
                    project.status !== 'COMPLETED' &&
                    project.status !== 'CANCELLED';

                  return (
                    <TableRow
                      key={project.id}
                      className="border-border/70 hover:bg-secondary/20 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/work/projects/${project.id}`}
                          className="text-foreground hover:text-primary transition-colors flex flex-col font-medium"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-sm">
                            {project.name}
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
                          </span>
                          {project.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs font-normal">
                              {project.description}
                            </span>
                          )}
                        </Link>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {project.customer ? (
                          <Link
                            href={`/crm/customers/${project.customer.id}`}
                            className="text-foreground hover:text-primary transition-colors font-medium flex items-center gap-1"
                          >
                            {project.customer.companyName || project.customer.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Internal</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            statusColors[project.status] || 'bg-secondary text-foreground'
                          }`}
                        >
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            priorityColors[project.priority] || 'bg-secondary text-foreground'
                          }`}
                        >
                          {project.priority}
                        </Badge>
                      </TableCell>

                      <TableCell className="w-36">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{project.progress}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                project.progress === 100
                                  ? 'bg-emerald-500'
                                  : project.progress >= 50
                                  ? 'bg-primary'
                                  : 'bg-blue-400'
                              }`}
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {project.stats ? (
                          <span>
                            <strong className="text-foreground">{project.stats.doneTasks}</strong>/
                            {project.stats.totalTasks} Done
                          </span>
                        ) : (
                          '0 tasks'
                        )}
                      </TableCell>

                      <TableCell className="text-xs">
                        {deadlineDate ? (
                          <span
                            className={`flex items-center gap-1 ${
                              isOverdue ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground'
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(deadlineDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/work/projects/${project.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-border/70 text-foreground hover:bg-secondary"
                            >
                              Manage
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchiveToggle(project)}
                            title={project.isArchived ? 'Restore Project' : 'Archive Project'}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          >
                            {project.isArchived ? (
                              <RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            Showing <strong className="text-foreground">{projects.length}</strong> of{' '}
            <strong className="text-foreground">{totalCount}</strong> projects
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

      {/* New Project Dialog */}
      <Dialog surface open={openCreate} onClose={() => setOpenCreate(false)} className="max-w-xl">
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" /> Create New Project
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpenCreate(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </Button>
          </div>

          {createError && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Project Name *
              </label>
              <Input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. NextGen Mobile Banking Portal"
                className="bg-secondary border-border/70 text-foreground"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Customer
                </label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Internal / No Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName ? `${c.companyName} (${c.name})` : c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Project Manager
                </label>
                <select
                  value={formManagerId}
                  onChange={(e) => setFormManagerId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ProjectStatus)}
                  className="w-full h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                  className="w-full h-9 px-3 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Start Date</label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Deadline</label>
                <Input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Budget</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formBudget}
                  onChange={(e) => setFormBudget(e.target.value)}
                  placeholder="e.g. 500000"
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Currency</label>
                <Input
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  placeholder="INR"
                  className="bg-secondary border-border/70 text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Description</label>
              <textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Scope, deliverables, and architecture outline..."
                className="w-full px-3 py-2 rounded-md text-xs bg-secondary border border-border/70 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/70">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenCreate(false)}
              className="text-xs border-border/70 text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              size="sm"
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
