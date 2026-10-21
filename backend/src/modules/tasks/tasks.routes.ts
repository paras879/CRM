import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  UpdateTaskStatusSchema,
  ListTasksQuerySchema,
  AddTaskCommentSchema,
} from './tasks.schema.js';
import * as controller from './tasks.controller.js';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get(
  '/',
  requirePermission('tasks.view'),
  validate({ query: ListTasksQuerySchema }),
  controller.listTasks
);

tasksRouter.get(
  '/:taskId',
  requirePermission('tasks.view'),
  controller.getTask
);

tasksRouter.post(
  '/',
  requirePermission('tasks.create'),
  validate({ body: CreateTaskSchema }),
  controller.createTask
);

tasksRouter.put(
  '/:taskId',
  requirePermission('tasks.update'),
  validate({ body: UpdateTaskSchema }),
  controller.updateTask
);

tasksRouter.patch(
  '/:taskId/status',
  requirePermission('tasks.update'),
  validate({ body: UpdateTaskStatusSchema }),
  controller.updateTaskStatus
);

tasksRouter.post(
  '/:taskId/comments',
  requirePermission('tasks.view'),
  validate({ body: AddTaskCommentSchema }),
  controller.addTaskComment
);

tasksRouter.delete(
  '/:taskId/comments/:commentId',
  requirePermission('tasks.view'),
  controller.deleteTaskComment
);
