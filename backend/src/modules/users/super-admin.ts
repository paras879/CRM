import { NextFunction, Request, Response } from 'express';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';

/**
 * A Super Admin is an Administrator who is additionally allowed to manage access itself: other
 * Super Admins, who holds the Administrator role, roles and permissions, and the company currency.
 * Everyone with the Administrator role keeps every day-to-day permission.
 */

interface Actor {
  companyId: string;
  roles: string[];
  isSuperAdmin: boolean;
}

export async function companyHasSuperAdmin(companyId: string): Promise<boolean> {
  if (!isDatabaseConnected) {
    return devStore.users.some((u) => u.companyId === companyId && u.isSuperAdmin && u.status === 'ACTIVE');
  }
  return (await prisma.user.count({ where: { companyId, isSuperAdmin: true, status: 'ACTIVE' } })) > 0;
}

/**
 * Whether this person may manage access. If a company has no active Super Admin at all (for example the
 * only one was deactivated in the database), its Administrators keep full control so nobody is locked out.
 */
export async function canManageAccess(actor: Actor): Promise<boolean> {
  if (!actor.roles.includes('Administrator')) return false;
  if (actor.isSuperAdmin) return true;
  return !(await companyHasSuperAdmin(actor.companyId));
}

export function requireSuperAdmin(action = 'do this') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (await canManageAccess(req.user!)) return next();
      next(AppError.forbidden(`Only a Super Admin can ${action}.`, 'SUPER_ADMIN_REQUIRED'));
    } catch (error) {
      next(error);
    }
  };
}

interface TargetUser {
  id: string;
  isSuperAdmin?: boolean | null;
  roles: Array<{ id: string; name: string }>;
}

async function rolesGrantAdministrator(companyId: string, roleIds: string[]): Promise<boolean> {
  if (roleIds.length === 0) return false;
  if (!isDatabaseConnected) {
    return devStore.roles.some((r) => r.companyId === companyId && roleIds.includes(r.id) && r.name === 'Administrator');
  }
  return (await prisma.role.count({ where: { companyId, id: { in: roleIds }, name: 'Administrator' } })) > 0;
}

/** Anyone may act on ordinary accounts; a Super Admin's account can only be changed by a Super Admin. */
export async function assertCanModifyUser(actor: Actor & { id: string }, target: TargetUser) {
  if (target.isSuperAdmin && !(await canManageAccess(actor))) {
    throw AppError.forbidden('Only a Super Admin can change a Super Admin account.', 'SUPER_ADMIN_REQUIRED');
  }
}

/** Creating an account or changing its roles: handing out (or taking away) Administrator is for Super Admins. */
export async function assertCanAssignRoles(
  actor: Actor & { id: string },
  newRoleIds: string[],
  target?: TargetUser
) {
  const currentlyAdmin = target?.roles.some((r) => r.name === 'Administrator') ?? false;
  const willBeAdmin = await rolesGrantAdministrator(actor.companyId, newRoleIds);

  if (target && target.id === actor.id) {
    const current = target.roles.map((r) => r.id).sort().join(',');
    if (current !== [...newRoleIds].sort().join(',')) {
      throw AppError.badRequest('You cannot change your own role. Ask another administrator.');
    }
  }

  if (currentlyAdmin !== willBeAdmin && !(await canManageAccess(actor))) {
    throw AppError.forbidden(
      'Only a Super Admin can give or remove the Administrator role.',
      'SUPER_ADMIN_REQUIRED'
    );
  }
}
