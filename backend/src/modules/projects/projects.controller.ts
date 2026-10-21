import { Request, Response, NextFunction } from 'express';
import * as projectsService from './projects.service.js';

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectsService.listProjects(
      req.user!.companyId,
      req.query as any
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.getProjectById(
      req.user!.companyId,
      req.params.projectId
    );
    res.json({ project });
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.createProject(
      req.user!.companyId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ project, message: 'Project created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.updateProject(
      req.user!.companyId,
      req.user!.id,
      req.params.projectId,
      req.body
    );
    res.json({ project, message: 'Project updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function archiveProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.archiveProject(
      req.user!.companyId,
      req.user!.id,
      req.params.projectId
    );
    res.json({ project, message: 'Project archived successfully' });
  } catch (error) {
    next(error);
  }
}

export async function restoreProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.restoreProject(
      req.user!.companyId,
      req.user!.id,
      req.params.projectId
    );
    res.json({ project, message: 'Project restored successfully' });
  } catch (error) {
    next(error);
  }
}

export async function addProjectMember(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await projectsService.addProjectMember(
      req.user!.companyId,
      req.user!.id,
      req.params.projectId,
      req.body
    );
    res.status(201).json({ member, message: 'Member added to project successfully' });
  } catch (error) {
    next(error);
  }
}

export async function removeProjectMember(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectsService.removeProjectMember(
      req.user!.companyId,
      req.user!.id,
      req.params.projectId,
      req.params.userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}
