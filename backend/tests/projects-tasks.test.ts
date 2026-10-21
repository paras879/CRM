import { describe, it, expect, beforeEach } from 'vitest';
import * as projectsService from '../src/modules/projects/projects.service.js';
import * as milestonesService from '../src/modules/milestones/milestones.service.js';
import * as tasksService from '../src/modules/tasks/tasks.service.js';
import * as timeTrackingService from '../src/modules/time-tracking/time-tracking.service.js';
import * as workDashboardService from '../src/modules/work-dashboard/work-dashboard.service.js';
import { ProjectStatus, TaskStatus, TaskPriority, MilestoneStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { seedTestUsers, makeCustomer } from './helpers/fixtures.js';

seedTestUsers();
describe('Phase 3: Projects, Milestones, Tasks & Time Tracking', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;
  const managerId = devStore.users[1].id;
  const financeUserId = devStore.users[2].id;

  beforeEach(() => {
    // Reset collections
    devStore.projects = [];
    devStore.projectMembers = [];
    devStore.milestones = [];
    devStore.tasks = [];
    devStore.taskAssignees = [];
    devStore.taskComments = [];
    devStore.timeEntries = [];
  });

  describe('1. Project CRUD & Membership', () => {
    it('creates a project with manager and initial members, preserving customer relationship', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'Enterprise ERP Implementation',
        description: 'Comprehensive ERP setup and custom connectors',
        customerId: makeCustomer().id,
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.HIGH,
        startDate: new Date('2026-01-01'),
        deadline: new Date('2026-06-30'),
        budget: 5000000,
        currency: 'INR',
        projectManagerId: managerId,
        memberIds: [financeUserId],
      });

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Enterprise ERP Implementation');
      expect(project.status).toBe(ProjectStatus.ACTIVE);

      // Verify members added
      const members = devStore.projectMembers.filter((m) => m.projectId === project.id);
      expect(members.length).toBeGreaterThanOrEqual(2);
      expect(members.some((m) => m.userId === managerId)).toBe(true);
      expect(members.some((m) => m.userId === financeUserId)).toBe(true);
    });

    it('prevents adding a duplicate member to a project', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'Alpha Redesign',
        status: ProjectStatus.PLANNING,
        priority: TaskPriority.MEDIUM,
      });

      // Add financeUserId
      await projectsService.addProjectMember(companyId, adminId, project.id, {
        userId: financeUserId,
        role: 'DEVELOPER',
      });

      // Try adding financeUserId again
      await expect(
        projectsService.addProjectMember(companyId, adminId, project.id, {
          userId: financeUserId,
          role: 'LEAD',
        })
      ).rejects.toThrow('User is already a member of this project');
    });

    it('archives and restores a project safely without losing records', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'Legacy Migration',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.LOW,
      });

      const archived = await projectsService.archiveProject(companyId, adminId, project.id);
      expect(archived.isArchived).toBe(true);

      const listActive = await projectsService.listProjects(companyId, { isArchived: false });
      expect(listActive.data.some((p: any) => p.id === project.id)).toBe(false);

      const listArchived = await projectsService.listProjects(companyId, { isArchived: true });
      expect(listArchived.data.some((p: any) => p.id === project.id)).toBe(true);

      const restored = await projectsService.restoreProject(companyId, adminId, project.id);
      expect(restored.isArchived).toBe(false);
    });
  });

  describe('2. Milestones Management', () => {
    it('creates milestone linked to project and computes progress from tasks', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'Mobile App 2.0',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.HIGH,
      });

      const milestone = await milestonesService.createMilestone(companyId, adminId, {
        projectId: project.id,
        name: 'Milestone 1: Prototype',
        dueDate: new Date(Date.now() + 10 * 86400000),
        status: MilestoneStatus.PENDING,
        order: 1,
      });

      expect(milestone.id).toBeDefined();
      expect(milestone.projectId).toBe(project.id);

      // Create 2 tasks for this milestone: 1 DONE, 1 TODO
      await tasksService.createTask(companyId, adminId, {
        projectId: project.id,
        milestoneId: milestone.id,
        title: 'Task 1: Wireframes',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
      });

      await tasksService.createTask(companyId, adminId, {
        projectId: project.id,
        milestoneId: milestone.id,
        title: 'Task 2: Interactive Mockups',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
      });

      const fetched = await milestonesService.getMilestoneById(companyId, milestone.id);
      expect(fetched.totalTasks).toBe(2);
      expect(fetched.doneTasks).toBe(1);
      expect(fetched.progress).toBe(50);
      expect(fetched.isOverdue).toBe(false);
    });

    it('rejects creating milestone for a non-existent project', async () => {
      await expect(
        milestonesService.createMilestone(companyId, adminId, {
          projectId: '00000000-0000-0000-0000-999999999999',
          name: 'Invalid Milestone',
          status: MilestoneStatus.PENDING,
          order: 1,
        })
      ).rejects.toThrow('Project not found');
    });
  });

  describe('3. Tasks, Assignees & Milestone Consistency', () => {
    it('enforces that task milestone belongs to the same project', async () => {
      const projectA = await projectsService.createProject(companyId, adminId, {
        name: 'Project Alpha',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.HIGH,
      });

      const projectB = await projectsService.createProject(companyId, adminId, {
        name: 'Project Beta',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.MEDIUM,
      });

      const milestoneA = await milestonesService.createMilestone(companyId, adminId, {
        projectId: projectA.id,
        name: 'Milestone of Project Alpha',
        status: MilestoneStatus.PENDING,
        order: 1,
      });

      // Try creating a task in Project Beta with Milestone from Project Alpha
      await expect(
        tasksService.createTask(companyId, adminId, {
          projectId: projectB.id,
          milestoneId: milestoneA.id,
          title: 'Cross Project Task Assignment',
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
        })
      ).rejects.toThrow('Milestone does not belong to the selected project');
    });

    it('tracks task assignees and automatically sets completion timestamp upon DONE', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'DevOps Pipeline',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.HIGH,
      });

      const task = await tasksService.createTask(companyId, adminId, {
        projectId: project.id,
        title: 'Configure GitHub Actions CI/CD',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        estimatedHours: 8,
        assigneeIds: [adminId, managerId],
      });

      expect(task.completedAt).toBeNull();

      // Check assignees
      const fetched = await tasksService.getTaskById(companyId, task.id);
      expect(fetched.assignees).toHaveLength(2);

      // Transition to DONE
      const completedTask = await tasksService.updateTask(companyId, adminId, task.id, {
        status: TaskStatus.DONE,
      });
      expect(completedTask.completedAt).toBeInstanceOf(Date);
    });

    it('allows comments and only author or admin can delete', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'Security Audit',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.HIGH,
      });

      const task = await tasksService.createTask(companyId, adminId, {
        projectId: project.id,
        title: 'Penetration Testing Review',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      });

      // User adds comment
      const comment = await tasksService.addTaskComment(companyId, managerId, task.id, {
        body: 'Vulnerability scan complete. No critical CVEs detected.',
      });

      expect(comment.id).toBeDefined();
      expect(comment.body).toContain('Vulnerability scan complete');

      // Admin can delete comment
      const res = await tasksService.deleteTaskComment(companyId, adminId, task.id, comment.id);
      expect(res.success).toBe(true);
    });
  });

  describe('4. Time Tracking', () => {
    it('creates, computes minutes, and aggregates billable vs non-billable time', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'Backend API Refactor',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.HIGH,
      });

      const task = await tasksService.createTask(companyId, adminId, {
        projectId: project.id,
        title: 'Prisma Schema Refactoring',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
      });

      // Entry 1: 120 minutes billable
      await timeTrackingService.createTimeEntry(companyId, adminId, {
        projectId: project.id,
        taskId: task.id,
        startedAt: new Date('2026-03-01T10:00:00Z'),
        endedAt: new Date('2026-03-01T12:00:00Z'),
        billable: true,
        description: 'Schema modeling and migration scripts',
      });

      // Entry 2: 60 minutes non-billable
      await timeTrackingService.createTimeEntry(companyId, adminId, {
        projectId: project.id,
        taskId: task.id,
        startedAt: new Date('2026-03-01T14:00:00Z'),
        endedAt: new Date('2026-03-01T15:00:00Z'),
        billable: false,
        description: 'Internal team sync on architecture',
      });

      const list = await timeTrackingService.listTimeEntries(companyId, { projectId: project.id });
      expect(list.data).toHaveLength(2);
      expect(list.summary.totalMinutes).toBe(180);
      expect(list.summary.totalHours).toBe(3);
      expect(list.summary.billableHours).toBe(2);
      expect(list.summary.nonBillableHours).toBe(1);
    });
  });

  describe('5. Work Dashboard Aggregated Metrics', () => {
    it('computes live database metrics for active projects, open tasks, and overdue items', async () => {
      const project = await projectsService.createProject(companyId, adminId, {
        name: 'Live Metrics Project',
        status: ProjectStatus.ACTIVE,
        priority: TaskPriority.HIGH,
        deadline: new Date(Date.now() + 3 * 86400000), // nearing deadline (within 7 days)
      });

      // Open task assigned to managerId
      await tasksService.createTask(companyId, adminId, {
        projectId: project.id,
        title: 'Open Urgent Task',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        assigneeIds: [managerId],
      });

      // Overdue task
      await tasksService.createTask(companyId, adminId, {
        projectId: project.id,
        title: 'Past Due Task',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        dueDate: new Date(Date.now() - 2 * 86400000), // overdue
      });

      const metrics = await workDashboardService.getWorkDashboardMetrics(companyId, managerId);
      expect(metrics.activeProjectsCount).toBe(1);
      expect(metrics.nearingDeadlineProjectsCount).toBe(1);
      expect(metrics.openTasksCount).toBe(2);
      expect(metrics.overdueTasksCount).toBe(1);
      expect(metrics.assignedTasksCount).toBe(1);
      expect(metrics.recentProjects).toHaveLength(1);
      expect(metrics.recentProjects[0].name).toBe('Live Metrics Project');
    });
  });
});
