import { Router } from 'express';
import { z } from 'zod';
import * as rolesController from './roles.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import { createRoleSchema, updateRoleSchema } from './roles.schema.js';

const router = Router();

const uuidParamSchema = z.object({
  roleId: z.string().uuid('Invalid role UUID format'),
});

router.use(requireAuth);

router.get('/', requirePermission('roles.view'), rolesController.listRoles);

router.post(
  '/',
  requirePermission('roles.manage'),
  validate({ body: createRoleSchema }),
  rolesController.createRole
);

router.get(
  '/:roleId',
  requirePermission('roles.view'),
  validate({ params: uuidParamSchema }),
  rolesController.getRole
);

router.patch(
  '/:roleId',
  requirePermission('roles.manage'),
  validate({ params: uuidParamSchema, body: updateRoleSchema }),
  rolesController.updateRole
);

router.delete(
  '/:roleId',
  requirePermission('roles.manage'),
  validate({ params: uuidParamSchema }),
  rolesController.deleteRole
);

export const rolesRouter = router;
