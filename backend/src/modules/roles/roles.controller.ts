import { Request, Response, NextFunction } from 'express';
import * as rolesService from './roles.service.js';
import { notifyAdminsOfRoleEvent } from '../notifications/work-notifications.js';

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await rolesService.listRoles(req.user!.companyId);
    res.json({ roles });
  } catch (error) {
    next(error);
  }
}

export async function getRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.getRoleById(req.user!.companyId, req.params.roleId);
    res.json({ role });
  } catch (error) {
    next(error);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.createRole(
      req.user!.companyId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ role, message: 'Role created successfully' });
    void notifyAdminsOfRoleEvent(req.user!.companyId, req.user!.id, 'created', { id: (role as any).id, name: (role as any).name });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.updateRole(
      req.user!.companyId,
      req.user!.id,
      req.params.roleId,
      req.body
    );
    res.json({ role, message: 'Role updated successfully' });
    void notifyAdminsOfRoleEvent(req.user!.companyId, req.user!.id, 'updated', { id: (role as any).id, name: (role as any).name });
  } catch (error) {
    next(error);
  }
}

export async function deleteRole(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await rolesService.getRoleById(req.user!.companyId, req.params.roleId);
    const result = await rolesService.deleteRole(
      req.user!.companyId,
      req.user!.id,
      req.params.roleId
    );
    res.json(result);
    void notifyAdminsOfRoleEvent(req.user!.companyId, req.user!.id, 'deleted', { id: req.params.roleId, name: (existing as any).name });
  } catch (error) {
    next(error);
  }
}
