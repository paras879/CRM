import { Request, Response, NextFunction } from 'express';
import * as milestonesService from './milestones.service.js';

export async function listMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    const milestones = await milestonesService.listMilestones(
      req.user!.companyId,
      req.query as any
    );
    res.json({ data: milestones });
  } catch (error) {
    next(error);
  }
}

export async function getMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await milestonesService.getMilestoneById(
      req.user!.companyId,
      req.params.milestoneId
    );
    res.json({ milestone });
  } catch (error) {
    next(error);
  }
}

export async function createMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await milestonesService.createMilestone(
      req.user!.companyId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ milestone, message: 'Milestone created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await milestonesService.updateMilestone(
      req.user!.companyId,
      req.user!.id,
      req.params.milestoneId,
      req.body
    );
    res.json({ milestone, message: 'Milestone updated successfully' });
  } catch (error) {
    next(error);
  }
}
