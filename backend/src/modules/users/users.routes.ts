import { Router } from 'express';
import { z } from 'zod';
import * as usersController from './users.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from './users.schema.js';

const router = Router();

const uuidParamSchema = z.object({
  userId: z.string().uuid('Invalid user UUID format'),
});

router.use(requireAuth);

router.get(
  '/',
  requirePermission('users.view'),
  validate({ query: listUsersQuerySchema }),
  usersController.listUsers
);

router.get('/team', requirePermission('dashboard.view'), usersController.getMyTeam);
// Company-wide account health: administrators only.
router.get('/stats', requirePermission('roles.view'), usersController.getUserStatsOverview);

router.post(
  '/',
  requirePermission('users.create'),
  validate({ body: createUserSchema }),
  usersController.createUser
);

router.post(
  '/:userId/password-reset',
  requirePermission('users.update'),
  validate({ params: uuidParamSchema }),
  usersController.issuePasswordReset
);

router.get(
  '/:userId',
  requirePermission('users.view'),
  validate({ params: uuidParamSchema }),
  usersController.getUser
);

router.patch(
  '/:userId',
  requirePermission('users.update'),
  validate({ params: uuidParamSchema, body: updateUserSchema }),
  usersController.updateUser
);

router.delete(
  '/:userId',
  requirePermission('users.delete'),
  validate({ params: uuidParamSchema }),
  usersController.deleteUser
);

export const usersRouter = router;
