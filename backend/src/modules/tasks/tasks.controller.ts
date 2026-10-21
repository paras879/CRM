import { Request, Response, NextFunction } from 'express';
import * as tasksService from './tasks.service.js';

/** User id to restrict task access to, or undefined for Administrators and Managers. */
function scopeOf(req: Request): string | undefined {
  return tasksService.isTaskElevated(req.user!.roles) ? undefined : req.user!.id;
}

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await tasksService.listTasks(
      req.user!.companyId,
      req.query as any,
      scopeOf(req)
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    await tasksService.assertTaskAccess(req.user!.companyId, req.params.taskId, scopeOf(req));
    const task = await tasksService.getTaskById(
      req.user!.companyId,
      req.params.taskId
    );
    res.json({ task });
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    // Non-elevated users can only create tasks for themselves
    const body = scopeOf(req) ? { ...req.body, assigneeIds: [req.user!.id] } : req.body;
    const task = await tasksService.createTask(
      req.user!.companyId,
      req.user!.id,
      body
    );
    res.status(201).json({ task, message: 'Task created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    await tasksService.assertTaskAccess(req.user!.companyId, req.params.taskId, scopeOf(req));
    // Non-elevated users cannot hand their task to someone else
    const { assigneeIds, ...rest } = req.body;
    const body = scopeOf(req) ? rest : req.body;
    const task = await tasksService.updateTask(
      req.user!.companyId,
      req.user!.id,
      req.params.taskId,
      body
    );
    res.json({ task, message: 'Task updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskStatus(req: Request, res: Response, next: NextFunction) {
  try {
    await tasksService.assertTaskAccess(req.user!.companyId, req.params.taskId, scopeOf(req));
    const task = await tasksService.updateTaskStatus(
      req.user!.companyId,
      req.user!.id,
      req.params.taskId,
      req.body.status
    );
    res.json({ task, message: 'Task status updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function addTaskComment(req: Request, res: Response, next: NextFunction) {
  try {
    await tasksService.assertTaskAccess(req.user!.companyId, req.params.taskId, scopeOf(req));
    const comment = await tasksService.addTaskComment(
      req.user!.companyId,
      req.user!.id,
      req.params.taskId,
      req.body
    );
    res.status(201).json({ comment, message: 'Comment added successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteTaskComment(req: Request, res: Response, next: NextFunction) {
  try {
    await tasksService.assertTaskAccess(req.user!.companyId, req.params.taskId, scopeOf(req));
    const result = await tasksService.deleteTaskComment(
      req.user!.companyId,
      req.user!.id,
      req.params.taskId,
      req.params.commentId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}
