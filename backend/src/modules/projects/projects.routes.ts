import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ListProjectsQuerySchema,
  AddProjectMemberSchema,
} from './projects.schema.js';
import * as controller from './projects.controller.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get(
  '/',
  requirePermission('projects.view'),
  validate({ query: ListProjectsQuerySchema }),
  controller.listProjects
);

projectsRouter.get(
  '/:projectId',
  requirePermission('projects.view'),
  controller.getProject
);

projectsRouter.post(
  '/',
  requirePermission('projects.create'),
  validate({ body: CreateProjectSchema }),
  controller.createProject
);

projectsRouter.put(
  '/:projectId',
  requirePermission('projects.update'),
  validate({ body: UpdateProjectSchema }),
  controller.updateProject
);

projectsRouter.patch(
  '/:projectId/archive',
  requirePermission('projects.update'),
  controller.archiveProject
);

projectsRouter.patch(
  '/:projectId/restore',
  requirePermission('projects.update'),
  controller.restoreProject
);

projectsRouter.post(
  '/:projectId/members',
  requirePermission('projects.update'),
  validate({ body: AddProjectMemberSchema }),
  controller.addProjectMember
);

projectsRouter.delete(
  '/:projectId/members/:userId',
  requirePermission('projects.update'),
  controller.removeProjectMember
);
