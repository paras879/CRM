import { Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { generateRandomToken } from '../../utils/tokens.js';
import { logger } from '../../utils/logger.js';

export interface CreateAuditLogParams {
  companyId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: any;
}

export async function recordAuditLog(params: CreateAuditLogParams) {
  try {
    if (!isDatabaseConnected) {
      const log = {
        id: generateRandomToken(16),
        companyId: params.companyId,
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        metadata: params.metadata || null,
        createdAt: new Date(),
      };
      devStore.auditLogs.unshift(log);
      return log;
    }

    const log = await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        metadata: params.metadata || Prisma.JsonNull,
      },
    });
    return log;
  } catch (error) {
    logger.error('Failed to create audit log entry', { error, params });
    return null;
  }
}

export async function listAuditLogs(
  companyId: string,
  options: {
    page?: number;
    limit?: number;
    entityType?: string;
    action?: string;
  }
) {
  if (!isDatabaseConnected) {
    let list = devStore.auditLogs.filter((l) => l.companyId === companyId);
    if (options.entityType) list = list.filter((l) => l.entityType === options.entityType);
    if (options.action) list = list.filter((l) => l.action === options.action);

    const formatted = list.map((l) => {
      const actor = l.actorId ? devStore.users.find((u) => u.id === l.actorId) : null;
      return {
        ...l,
        actor: actor ? { id: actor.id, name: actor.name, email: actor.email } : null,
      };
    });

    return {
      data: formatted,
      pagination: {
        page: 1,
        limit: 50,
        total: formatted.length,
        totalPages: 1,
      },
    };
  }

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    companyId,
    ...(options.entityType ? { entityType: options.entityType } : {}),
    ...(options.action ? { action: options.action } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
