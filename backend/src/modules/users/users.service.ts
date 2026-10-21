import { Prisma, UserStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { hashPassword } from '../../utils/password.js';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.schema.js';
import { wouldCreateReportingLoop } from './team.service.js';

const MANAGER_SELECT = { id: true, name: true } as const;

async function assertValidManager(companyId: string, managerId: string, userId?: string) {
  const manager = !isDatabaseConnected
    ? devStore.users.find((u) => u.id === managerId && u.companyId === companyId)
    : await prisma.user.findFirst({ where: { id: managerId, companyId } });
  if (!manager) {
    throw AppError.badRequest('Selected manager does not exist in your company');
  }
  if (manager.status === UserStatus.DISABLED) {
    throw AppError.badRequest('Selected manager is deactivated');
  }
  if (userId && (await wouldCreateReportingLoop(companyId, userId, managerId))) {
    throw AppError.badRequest('A user cannot report to themselves or to someone on their own team');
  }
}

function devManager(managerId?: string | null) {
  const m = managerId ? devStore.users.find((u) => u.id === managerId) : null;
  return m ? { id: m.id, name: m.name } : null;
}

export async function listUsers(companyId: string, query: ListUsersQuery, scopeUserIds?: string[] | null) {
  if (!isDatabaseConnected) {
    let list = devStore.users.filter(
      (u) => u.companyId === companyId && (!scopeUserIds || scopeUserIds.includes(u.id))
    );
    if (query.status) {
      list = list.filter((u) => u.status === query.status);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    const formatted = list.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      managerId: u.managerId ?? null,
      manager: devManager(u.managerId),
      roles: devStore.roles
        .filter((r) => u.roleIds.includes(r.id))
        .map((r) => ({ id: r.id, name: r.name })),
    }));
    return {
      data: formatted,
      pagination: { page: 1, limit: 50, total: formatted.length, totalPages: 1 },
    };
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    companyId,
    ...(scopeUserIds ? { id: { in: scopeUserIds } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        managerId: true,
        manager: { select: MANAGER_SELECT },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const formattedUsers = items.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    managerId: u.managerId,
    manager: u.manager,
    roles: u.userRoles.map((ur) => ur.role),
  }));

  return {
    data: formattedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(companyId: string, userId: string, scopeUserIds?: string[] | null) {
  if (scopeUserIds && !scopeUserIds.includes(userId)) {
    throw AppError.notFound('User not found');
  }

  if (!isDatabaseConnected) {
    const user = devStore.users.find((u) => u.id === userId && u.companyId === companyId);
    if (!user) throw AppError.notFound('User not found');

    const roles = devStore.roles.filter((r) => user.roleIds.includes(r.id));
    const permSet = new Set<string>();
    roles.forEach((r) => r.permissionKeys.forEach((k) => permSet.add(k)));

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      managerId: user.managerId ?? null,
      manager: devManager(user.managerId),
      roles: roles.map((r) => ({ id: r.id, name: r.name, description: r.description })),
      permissions: Array.from(permSet),
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      managerId: true,
      manager: { select: MANAGER_SELECT },
      userRoles: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  const permissionSet = new Set<string>();
  const roles = user.userRoles.map((ur) => {
    ur.role.permissions.forEach((rp) => permissionSet.add(rp.permission.key));
    return {
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
    };
  });

  return {
    ...user,
    roles,
    permissions: Array.from(permissionSet),
  };
}

export async function createUser(
  companyId: string,
  actorId: string,
  data: CreateUserInput
) {
  if (data.managerId) {
    await assertValidManager(companyId, data.managerId);
  }

  if (!isDatabaseConnected) {
    const existing = devStore.users.find(
      (u) => u.companyId === companyId && u.email.toLowerCase() === data.email.toLowerCase()
    );
    if (existing) {
      throw AppError.conflict('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(data.password);
    const newUser = {
      id: randomUUID(),
      companyId,
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      status: data.status,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roleIds: data.roleIds,
      managerId: data.managerId ?? null,
    };
    devStore.users.unshift(newUser);

    await recordAuditLog({
      companyId,
      actorId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: newUser.id,
      metadata: { email: newUser.email },
    });

    return getUserById(companyId, newUser.id);
  }

  const existing = await prisma.user.findUnique({
    where: {
      companyId_email: {
        companyId,
        email: data.email,
      },
    },
  });

  if (existing) {
    throw AppError.conflict('A user with this email address already exists in your company');
  }

  const roles = await prisma.role.findMany({
    where: {
      id: { in: data.roleIds },
      companyId,
    },
  });

  if (roles.length !== data.roleIds.length) {
    throw AppError.badRequest('One or more selected roles are invalid or do not exist');
  }

  const passwordHash = await hashPassword(data.password);

  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        companyId,
        name: data.name,
        email: data.email,
        passwordHash,
        status: data.status,
        managerId: data.managerId ?? null,
      },
    });

    for (const roleId of data.roleIds) {
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId,
        },
      });
    }

    return user;
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: newUser.id,
    metadata: { email: newUser.email, roles: roles.map((r) => r.name) },
  });

  return getUserById(companyId, newUser.id);
}

export async function updateUser(
  companyId: string,
  actorId: string,
  userId: string,
  data: UpdateUserInput
) {
  if (data.managerId) {
    await assertValidManager(companyId, data.managerId, userId);
  }

  if (!isDatabaseConnected) {
    const user = devStore.users.find((u) => u.id === userId && u.companyId === companyId);
    if (!user) throw AppError.notFound('User not found');

    if (data.name) user.name = data.name;
    if (data.email) user.email = data.email.toLowerCase();
    if (data.status) user.status = data.status;
    if (data.roleIds) user.roleIds = data.roleIds;
    if (data.managerId !== undefined) user.managerId = data.managerId;
    if (data.password) user.passwordHash = await hashPassword(data.password);
    user.updatedAt = new Date();

    await recordAuditLog({
      companyId,
      actorId,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { updatedFields: Object.keys(data) },
    });

    return getUserById(companyId, userId);
  }

  const existing = await prisma.user.findFirst({
    where: { id: userId, companyId },
  });

  if (!existing) {
    throw AppError.notFound('User not found');
  }

  if (data.email && data.email !== existing.email) {
    const emailConflict = await prisma.user.findUnique({
      where: {
        companyId_email: {
          companyId,
          email: data.email,
        },
      },
    });
    if (emailConflict) {
      throw AppError.conflict('A user with this email already exists');
    }
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.status) updateData.status = data.status;
  if (data.password) updateData.passwordHash = await hashPassword(data.password);
  if (data.managerId !== undefined) {
    updateData.manager = data.managerId ? { connect: { id: data.managerId } } : { disconnect: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (data.roleIds) {
      const roles = await tx.role.findMany({
        where: { id: { in: data.roleIds }, companyId },
      });
      if (roles.length !== data.roleIds.length) {
        throw AppError.badRequest('One or more selected roles are invalid');
      }

      await tx.userRole.deleteMany({ where: { userId } });
      for (const roleId of data.roleIds) {
        await tx.userRole.create({
          data: { userId, roleId },
        });
      }
    }

    if (data.status === UserStatus.DISABLED) {
      await tx.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      });
    }
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: userId,
    metadata: { updatedFields: Object.keys(data) },
  });

  return getUserById(companyId, userId);
}

export async function deleteOrDeactivateUser(
  companyId: string,
  actorId: string,
  userId: string
) {
  if (userId === actorId) {
    throw AppError.badRequest('You cannot deactivate or delete your own account');
  }

  if (!isDatabaseConnected) {
    const user = devStore.users.find((u) => u.id === userId && u.companyId === companyId);
    if (!user) throw AppError.notFound('User not found');

    user.status = UserStatus.DISABLED;
    await recordAuditLog({
      companyId,
      actorId,
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: userId,
    });
    return { message: 'User has been deactivated successfully' };
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DISABLED },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    }),
  ]);

  await recordAuditLog({
    companyId,
    actorId,
    action: 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: userId,
  });

  return { message: 'User has been deactivated successfully' };
}

/**
 * Permanently remove an account. Unlike deactivating, this cannot be undone. Accounts that own history that
 * must stay attributable (payments they recorded, notes, ticket replies, articles) cannot be removed; those
 * should be deactivated instead.
 */
export async function deleteUserPermanently(companyId: string, actorId: string, userId: string) {
  if (userId === actorId) {
    throw AppError.badRequest('You cannot delete your own account');
  }

  const lastAdminMessage = 'You cannot delete the last active administrator. Make someone else an administrator first.';
  let removed: { name: string; email: string };

  if (!isDatabaseConnected) {
    const user = devStore.users.find((u) => u.id === userId && u.companyId === companyId);
    if (!user) throw AppError.notFound('User not found');

    const isAdminRole = (u: (typeof devStore.users)[number]) =>
      devStore.roles.some((r) => u.roleIds.includes(r.id) && r.name === 'Administrator');
    const otherActiveAdmins = devStore.users.filter(
      (u) => u.companyId === companyId && u.id !== userId && u.status === UserStatus.ACTIVE && isAdminRole(u)
    ).length;
    if (isAdminRole(user) && otherActiveAdmins === 0) throw AppError.badRequest(lastAdminMessage);

    removed = { name: user.name, email: user.email };
    devStore.users = devStore.users.filter((u) => u.id !== userId);
    // Same effect as the database's "set null" rules.
    devStore.users.forEach((u) => {
      if (u.managerId === userId) u.managerId = null;
    });
  } else {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { name: true, email: true, userRoles: { select: { role: { select: { name: true } } } } },
    });
    if (!user) throw AppError.notFound('User not found');

    if (user.userRoles.some((ur) => ur.role.name === 'Administrator')) {
      const otherActiveAdmins = await prisma.user.count({
        where: {
          companyId,
          id: { not: userId },
          status: UserStatus.ACTIVE,
          userRoles: { some: { role: { name: 'Administrator' } } },
        },
      });
      if (otherActiveAdmins === 0) throw AppError.badRequest(lastAdminMessage);
    }

    removed = { name: user.name, email: user.email };
    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch (error) {
      // P2003: another record still points at this user and must keep its author.
      if ((error as { code?: string }).code === 'P2003') {
        throw AppError.conflict(
          'This user has recorded payments, notes, replies or articles, so they cannot be deleted. Deactivate the account instead.',
          'USER_HAS_HISTORY'
        );
      }
      throw error;
    }
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: userId,
    metadata: { name: removed.name, email: removed.email },
  });

  return { message: 'User has been deleted permanently', name: removed.name };
}
