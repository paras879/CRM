import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { generateRandomToken } from '../../utils/tokens.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { CreateRoleInput, UpdateRoleInput } from './roles.schema.js';

export async function listRoles(companyId: string) {
  if (!isDatabaseConnected) {
    return devStore.roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      usersCount: devStore.users.filter((u) => u.roleIds.includes(role.id)).length,
      permissionsCount: role.permissionKeys.length,
      permissionKeys: role.permissionKeys,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  const roles = await prisma.role.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: {
          userRoles: true,
          permissions: true,
        },
      },
      permissions: {
        include: {
          permission: {
            select: {
              key: true,
              module: true,
            },
          },
        },
      },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    usersCount: role._count.userRoles,
    permissionsCount: role._count.permissions,
    permissionKeys: role.permissions.map((p) => p.permission.key),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }));
}

export async function getRoleById(companyId: string, roleId: string) {
  if (!isDatabaseConnected) {
    const role = devStore.roles.find((r) => r.id === roleId);
    if (!role) throw AppError.notFound('Role not found');
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      usersCount: devStore.users.filter((u) => u.roleIds.includes(role.id)).length,
      permissions: role.permissionKeys.map((k) => ({ key: k })),
      permissionKeys: role.permissionKeys,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, companyId },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
      _count: {
        select: {
          userRoles: true,
        },
      },
    },
  });

  if (!role) {
    throw AppError.notFound('Role not found');
  }

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    usersCount: role._count.userRoles,
    permissions: role.permissions.map((p) => p.permission),
    permissionKeys: role.permissions.map((p) => p.permission.key),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export async function createRole(
  companyId: string,
  actorId: string,
  data: CreateRoleInput
) {
  if (!isDatabaseConnected) {
    const existing = devStore.roles.find(
      (r) => r.companyId === companyId && r.name.toLowerCase() === data.name.toLowerCase()
    );
    if (existing) {
      throw AppError.conflict('A role with this name already exists');
    }

    const newRole = {
      id: generateRandomToken(16),
      companyId,
      name: data.name,
      description: data.description || null,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissionKeys: data.permissionKeys,
    };
    devStore.roles.push(newRole);

    await recordAuditLog({
      companyId,
      actorId,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: newRole.id,
      metadata: { roleName: newRole.name },
    });

    return getRoleById(companyId, newRole.id);
  }

  const existing = await prisma.role.findUnique({
    where: {
      companyId_name: {
        companyId,
        name: data.name,
      },
    },
  });

  if (existing) {
    throw AppError.conflict('A role with this name already exists in your company');
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: data.permissionKeys } },
  });

  if (permissions.length !== data.permissionKeys.length) {
    throw AppError.badRequest('One or more permission keys are invalid');
  }

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        companyId,
        name: data.name,
        description: data.description || null,
        isSystem: false,
      },
    });

    for (const p of permissions) {
      await tx.rolePermission.create({
        data: {
          roleId: created.id,
          permissionId: p.id,
        },
      });
    }

    return created;
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ROLE_CREATED',
    entityType: 'Role',
    entityId: role.id,
    metadata: { roleName: role.name, permissionsCount: permissions.length },
  });

  return getRoleById(companyId, role.id);
}

export async function updateRole(
  companyId: string,
  actorId: string,
  roleId: string,
  data: UpdateRoleInput
) {
  if (!isDatabaseConnected) {
    const role = devStore.roles.find((r) => r.id === roleId && r.companyId === companyId);
    if (!role) throw AppError.notFound('Role not found');
    if (role.name === 'Administrator' && data.name && data.name !== 'Administrator') {
      throw AppError.badRequest('The core Administrator role name cannot be modified');
    }
    if (data.name) role.name = data.name;
    if (data.description !== undefined) role.description = data.description || null;
    if (data.permissionKeys) role.permissionKeys = data.permissionKeys;
    role.updatedAt = new Date();

    await recordAuditLog({
      companyId,
      actorId,
      action: 'ROLE_UPDATED',
      entityType: 'Role',
      entityId: roleId,
      metadata: { updatedFields: Object.keys(data) },
    });

    return getRoleById(companyId, roleId);
  }

  const existing = await prisma.role.findFirst({
    where: { id: roleId, companyId },
  });

  if (!existing) {
    throw AppError.notFound('Role not found');
  }

  if (existing.name === 'Administrator' && data.name && data.name !== 'Administrator') {
    throw AppError.badRequest('The core Administrator role name cannot be modified');
  }

  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: roleId },
      data: {
        name: data.name || undefined,
        description: data.description !== undefined ? data.description : undefined,
      },
    });

    if (data.permissionKeys) {
      const permissions = await tx.permission.findMany({
        where: { key: { in: data.permissionKeys } },
      });

      if (permissions.length !== data.permissionKeys.length) {
        throw AppError.badRequest('One or more permission keys are invalid');
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });

      for (const p of permissions) {
        await tx.rolePermission.create({
          data: {
            roleId,
            permissionId: p.id,
          },
        });
      }
    }
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ROLE_UPDATED',
    entityType: 'Role',
    entityId: roleId,
    metadata: { updatedFields: Object.keys(data) },
  });

  return getRoleById(companyId, roleId);
}

export async function deleteRole(companyId: string, actorId: string, roleId: string) {
  if (!isDatabaseConnected) {
    const idx = devStore.roles.findIndex((r) => r.id === roleId && r.companyId === companyId);
    if (idx === -1) throw AppError.notFound('Role not found');
    if (devStore.roles[idx].isSystem) {
      throw AppError.badRequest('System default roles cannot be deleted');
    }
    devStore.roles.splice(idx, 1);
    return { message: 'Role deleted successfully' };
  }

  const existing = await prisma.role.findFirst({
    where: { id: roleId, companyId },
    include: {
      _count: {
        select: {
          userRoles: true,
        },
      },
    },
  });

  if (!existing) {
    throw AppError.notFound('Role not found');
  }

  if (existing.isSystem || existing.name === 'Administrator') {
    throw AppError.badRequest('System default roles cannot be deleted');
  }

  if (existing._count.userRoles > 0) {
    throw AppError.badRequest(
      `Cannot delete role because it is currently assigned to ${existing._count.userRoles} user(s). Reassign them first.`
    );
  }

  await prisma.role.delete({ where: { id: roleId } });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ROLE_DELETED',
    entityType: 'Role',
    entityId: roleId,
    metadata: { roleName: existing.name },
  });

  return { message: 'Role deleted successfully' };
}
