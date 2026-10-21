import { Request, Response, NextFunction } from 'express';
import * as activitiesService from './activities.service.js';
import { notifyActivityAssigned } from '../notifications/work-notifications.js';

export async function listActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await activitiesService.listActivities(req.user!.companyId, req.query as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const activity = await activitiesService.getActivityById(req.user!.companyId, req.params.activityId);
    res.json({ activity });
  } catch (error) {
    next(error);
  }
}

export async function createActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const activity = await activitiesService.createActivity(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ activity, message: 'Activity created successfully' });
    void notifyActivityAssigned(req.user!.companyId, req.user!.id, activity as any);
  } catch (error) {
    next(error);
  }
}

export async function updateActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const activity = await activitiesService.updateActivity(req.user!.companyId, req.user!.id, req.params.activityId, req.body);
    res.json({ activity, message: 'Activity updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function completeActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const activity = await activitiesService.completeActivity(req.user!.companyId, req.user!.id, req.params.activityId, req.body);
    res.json({ activity, message: 'Activity completed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function rescheduleActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const activity = await activitiesService.rescheduleActivity(req.user!.companyId, req.user!.id, req.params.activityId, req.body);
    res.json({ activity, message: 'Activity rescheduled successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await activitiesService.deleteActivity(req.user!.companyId, req.user!.id, req.params.activityId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
