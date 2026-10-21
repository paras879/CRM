import { describe, it, expect, beforeEach } from 'vitest';
import * as activitiesService from '../src/modules/activities/activities.service.js';
import { ActivityType, ActivityStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';

describe('Follow-ups & Activities Service', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;

  beforeEach(() => {
    devStore.activities = [];
    devStore.notes = [];
  });

  it('creates and distinguishes upcoming vs overdue follow-ups', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const overdueActivity = await activitiesService.createActivity(companyId, adminId, {
      type: ActivityType.CALL,
      subject: 'Past Due Discovery Call',
      dueDate: yesterday.toISOString(),
    });

    const upcomingActivity = await activitiesService.createActivity(companyId, adminId, {
      type: ActivityType.MEETING,
      subject: 'Upcoming Strategic Review',
      dueDate: tomorrow.toISOString(),
    });

    const overdueList = await activitiesService.listActivities(companyId, {
      timeframe: 'overdue',
      page: 1,
      limit: 20,
    } as any);

    const upcomingList = await activitiesService.listActivities(companyId, {
      timeframe: 'upcoming',
      page: 1,
      limit: 20,
    } as any);

    expect(overdueList.data.some((a) => a.id === overdueActivity.id)).toBe(true);
    expect(overdueList.data.some((a) => a.id === upcomingActivity.id)).toBe(false);

    expect(upcomingList.data.some((a) => a.id === upcomingActivity.id)).toBe(true);
    expect(upcomingList.data.some((a) => a.id === overdueActivity.id)).toBe(false);
  });

  it('completes an activity and optionally records a completion note', async () => {
    const activity = await activitiesService.createActivity(companyId, adminId, {
      type: ActivityType.TASK,
      subject: 'Send Security Whitepaper',
      dueDate: new Date().toISOString(),
    });

    const completed = await activitiesService.completeActivity(companyId, adminId, activity.id, {
      completionNote: 'Sent whitepaper v2.4 via encrypted email link.',
    });

    expect(completed.status).toBe(ActivityStatus.COMPLETED);
    expect(completed.completedAt).toBeDefined();

    expect(devStore.notes).toHaveLength(1);
    expect(devStore.notes[0].body).toContain('Sent whitepaper v2.4');
  });

  it('reschedules an activity with audit record and note', async () => {
    const originalDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const newDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const activity = await activitiesService.createActivity(companyId, adminId, {
      type: ActivityType.FOLLOW_UP,
      subject: 'Follow-up on budget approval',
      dueDate: originalDate.toISOString(),
    });

    const rescheduled = await activitiesService.rescheduleActivity(companyId, adminId, activity.id, {
      newDueDate: newDate.toISOString(),
      reason: 'Client requested postponement until next board meeting.',
    });

    expect(rescheduled.dueDate?.getTime()).toBe(newDate.getTime());
    expect(rescheduled.status).toBe(ActivityStatus.PENDING);
    expect(devStore.notes[0].body).toContain('Client requested postponement');
  });
});
