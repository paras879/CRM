import { Request, Response, NextFunction } from 'express';
import * as timeTrackingService from './time-tracking.service.js';

export async function listTimeEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await timeTrackingService.listTimeEntries(
      req.user!.companyId,
      req.query as any
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createTimeEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await timeTrackingService.createTimeEntry(
      req.user!.companyId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ entry, message: 'Time entry recorded successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateTimeEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await timeTrackingService.updateTimeEntry(
      req.user!.companyId,
      req.user!.id,
      req.params.entryId,
      req.body
    );
    res.json({ entry, message: 'Time entry updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteTimeEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await timeTrackingService.deleteTimeEntry(
      req.user!.companyId,
      req.user!.id,
      req.params.entryId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}
