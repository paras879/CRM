import { Request, Response, NextFunction } from 'express';
import { issuePasswordReset as issueReset } from '../auth/password-reset.service.js';
import * as usersService from './users.service.js';
import { getTeamOverview, getTeamUserIds, getUserStats, isTeamScopedManager } from './team.service.js';
import { notifyAdminsOfUserEvent } from '../notifications/work-notifications.js';

/** Managers only see people in their own reporting tree; everyone else keeps their normal access. */
async function userScopeFor(req: Request): Promise<string[] | null> {
  return isTeamScopedManager(req.user!.roles) ? getTeamUserIds(req.user!.companyId, req.user!.id) : null;
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.listUsers(req.user!.companyId, req.query as any, await userScopeFor(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUserStatsOverview(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getUserStats(req.user!.companyId) });
  } catch (error) {
    next(error);
  }
}

export async function getMyTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await getTeamOverview(req.user!.companyId, req.user!.id);
    res.json({ data: members });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getUserById(req.user!.companyId, req.params.userId, await userScopeFor(req));
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.createUser(
      req.user!.companyId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ user, message: 'User created successfully' });
    void notifyAdminsOfUserEvent(req.user!.companyId, req.user!.id, 'created', { id: user.id, name: user.name });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const before = req.body.roleIds || req.body.status ? await usersService.getUserById(req.user!.companyId, req.params.userId) : null;
    const user = await usersService.updateUser(
      req.user!.companyId,
      req.user!.id,
      req.params.userId,
      req.body
    );
    res.json({ user, message: 'User updated successfully' });

    const target = { id: user.id, name: user.name };
    const roleIds = (list: Array<{ id: string }>) => list.map((r) => r.id).sort().join(',');
    if (before && Array.isArray(req.body.roleIds) && roleIds(before.roles) !== [...req.body.roleIds].sort().join(',')) {
      void notifyAdminsOfUserEvent(req.user!.companyId, req.user!.id, 'roles_changed', target);
    }
    if (before && req.body.status === 'DISABLED' && before.status !== 'DISABLED') {
      void notifyAdminsOfUserEvent(req.user!.companyId, req.user!.id, 'deactivated', target);
    }
  } catch (error) {
    next(error);
  }
}

export async function issuePasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await issueReset(req.user!.companyId, req.user!.id, req.params.userId);
    res.status(201).json({ data: result });
    void notifyAdminsOfUserEvent(req.user!.companyId, req.user!.id, 'password_reset', {
      id: req.params.userId,
      name: result.user?.name ?? 'a user',
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const target = await usersService.getUserById(req.user!.companyId, req.params.userId);
    if (req.query.permanent === 'true') {
      const removed = await usersService.deleteUserPermanently(req.user!.companyId, req.user!.id, req.params.userId);
      res.json(removed);
      void notifyAdminsOfUserEvent(req.user!.companyId, req.user!.id, 'deleted', { id: target.id, name: target.name });
      return;
    }
    const result = await usersService.deleteOrDeactivateUser(
      req.user!.companyId,
      req.user!.id,
      req.params.userId
    );
    res.json(result);
    void notifyAdminsOfUserEvent(req.user!.companyId, req.user!.id, 'deactivated', { id: target.id, name: target.name });
  } catch (error) {
    next(error);
  }
}
