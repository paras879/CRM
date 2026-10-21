import { ContractStatus, Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevContract } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { generateDocumentNumber } from '../../utils/document-numbering.js';
import { roundMoney } from '../../utils/financial-math.js';
import { CreateContractInput, UpdateContractInput, ListContractsQuery } from './contracts.schema.js';

export function evaluateContractStatus(
  status: ContractStatus,
  endDate: Date | null
): ContractStatus {
  if (status === ContractStatus.DRAFT || status === ContractStatus.TERMINATED) {
    return status;
  }
  if (!endDate) return status;

  const now = Date.now();
  const end = new Date(endDate).getTime();
  const thirtyDays = 30 * 86400000;

  if (end < now) return ContractStatus.EXPIRED;
  if (end - now <= thirtyDays) return ContractStatus.EXPIRING;
  return ContractStatus.ACTIVE;
}

export async function listContracts(companyId: string, query: ListContractsQuery) {
  const { page, limit, search, customerId, projectId, status, expiringSoon, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    try {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000);
      const now = new Date();

      const where: Prisma.ContractWhereInput = {
        companyId,
        isArchived: false,
        ...(customerId ? { customerId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
        ...(expiringSoon
          ? {
            endDate: { gte: now, lte: thirtyDaysFromNow },
            status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING] },
          }
          : {}),
        ...(search
          ? {
            OR: [
              { contractNumber: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
          : {}),
      };

      const [contracts, totalCount] = await Promise.all([
        prisma.contract.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, email: true, companyName: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.contract.count({ where }),
      ]);

      const formatted = contracts.map((c) => ({
        ...c,
        value: Number(c.value),
        calculatedStatus: evaluateContractStatus(c.status, c.endDate),
      }));

      return {
        data: formatted,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  let list = devStore.contracts.filter((c) => c.companyId === companyId && !c.isArchived);

  if (customerId) list = list.filter((c) => c.customerId === customerId);
  if (projectId) list = list.filter((c) => c.projectId === projectId);
  if (status) list = list.filter((c) => c.status === status);

  if (expiringSoon) {
    const thirtyDaysFromNow = Date.now() + 30 * 86400000;
    const now = Date.now();
    list = list.filter((c) => {
      if (!c.endDate) return false;
      const end = new Date(c.endDate).getTime();
      return end >= now && end <= thirtyDaysFromNow;
    });
  }

  if (search) {
    const s = search.toLowerCase();
    list = list.filter((c) => {
      const cust = devStore.customers.find((cust) => cust.id === c.customerId);
      return (
        c.contractNumber.toLowerCase().includes(s) ||
        c.subject.toLowerCase().includes(s) ||
        (cust && cust.name.toLowerCase().includes(s))
      );
    });
  }

  list.sort((a, b) => {
    let aVal: any = a[sortBy as keyof DevContract];
    let bVal: any = b[sortBy as keyof DevContract];
    if (aVal instanceof Date) aVal = aVal.getTime();
    if (bVal instanceof Date) bVal = bVal.getTime();
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalCount = list.length;
  const paged = list.slice(skip, skip + limit);

  const formatted = paged.map((c) => {
    const customer = devStore.customers.find((cust) => cust.id === c.customerId);
    const project = c.projectId ? devStore.projects.find((p) => p.id === c.projectId) : null;
    return {
      ...c,
      calculatedStatus: evaluateContractStatus(c.status, c.endDate),
      customer: customer ? { id: customer.id, name: customer.name, email: customer.email, companyName: customer.companyName } : null,
      project: project ? { id: project.id, name: project.name } : null,
    };
  });

  return {
    data: formatted,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

export async function getContractById(companyId: string, contractId: string) {
  if (isDatabaseConnected) {
    try {
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, companyId },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true, address: true, city: true, state: true, country: true, companyName: true } },
          project: { select: { id: true, name: true } },
        },
      });

      if (!contract) throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');

      return {
        ...contract,
        value: Number(contract.value),
        calculatedStatus: evaluateContractStatus(contract.status, contract.endDate),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
    }
  }

  // DevStore
  const contract = devStore.contracts.find((c) => c.id === contractId && c.companyId === companyId);
  if (!contract) throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');

  const customer = devStore.customers.find((c) => c.id === contract.customerId);
  const project = contract.projectId ? devStore.projects.find((p) => p.id === contract.projectId) : null;

  return {
    ...contract,
    calculatedStatus: evaluateContractStatus(contract.status, contract.endDate),
    customer: customer || null,
    project: project || null,
  };
}

export async function createContract(companyId: string, actorId: string, input: CreateContractInput) {
  // Validate customer
  if (isDatabaseConnected) {
    const cust = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
    if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found in this company');
    if (input.projectId) {
      const proj = await prisma.project.findFirst({ where: { id: input.projectId, companyId } });
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project not found in this company');
    }
  } else {
    const cust = devStore.customers.find((c) => c.id === input.customerId && c.companyId === companyId);
    if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found in this company');
    if (input.projectId) {
      const proj = devStore.projects.find((p) => p.id === input.projectId && p.companyId === companyId);
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project not found in this company');
    }
  }

  const contractNumber = await generateDocumentNumber(companyId, 'contract');
  const startDate = new Date(input.startDate);
  const endDate = input.endDate ? new Date(input.endDate) : null;

  if (endDate && endDate.getTime() < startDate.getTime()) {
    throw new AppError(400, 'INVALID_DATES', 'Contract end date must be on or after start date');
  }

  const initialStatus = evaluateContractStatus(input.status || ContractStatus.DRAFT, endDate);

  if (isDatabaseConnected) {
    try {
      const created = await prisma.contract.create({
        data: {
          companyId,
          customerId: input.customerId,
          projectId: input.projectId || null,
          contractNumber,
          subject: input.subject,
          contractType: input.contractType || 'Standard',
          value: roundMoney(input.value !== undefined ? input.value : ((input as any).contractValue ?? 0)),
          currency: input.currency || 'INR',
          status: initialStatus,
          startDate,
          endDate,
          description: input.description || null,
          terms: input.terms || null,
          attachmentUrl: input.attachmentUrl || null,
        },
        include: { customer: true, project: true },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CONTRACT_CREATED',
          entityType: 'Contract',
          entityId: created.id,
          metadata: { contractNumber, value: Number(created.value), status: initialStatus },
        },
      });

      return {
        ...created,
        value: Number(created.value),
        calculatedStatus: initialStatus,
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const newId = `d1000000-0000-0000-0000-${String(devStore.contracts.length + 1).padStart(12, '0')}`;
  const newContract: DevContract = {
    id: newId,
    companyId,
    customerId: input.customerId,
    projectId: input.projectId || null,
    contractNumber,
    subject: input.subject,
    contractType: input.contractType || 'Standard',
    value: roundMoney(input.value !== undefined ? input.value : ((input as any).contractValue ?? 0)),
    currency: input.currency || 'INR',
    status: initialStatus,
    startDate,
    endDate,
    description: input.description || null,
    terms: input.terms || null,
    attachmentUrl: input.attachmentUrl || null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.contracts.unshift(newContract);

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'CONTRACT_CREATED',
    entityType: 'Contract',
    entityId: newId,
    metadata: { contractNumber, value: newContract.value, status: initialStatus },
    createdAt: new Date(),
  });

  return {
    ...newContract,
    calculatedStatus: initialStatus,
    customer: devStore.customers.find((c) => c.id === input.customerId) || null,
    project: input.projectId ? devStore.projects.find((p) => p.id === input.projectId) || null : null,
  };
}

export async function updateContract(
  companyId: string,
  contractId: string,
  actorId: string,
  input: UpdateContractInput
) {
  const existing = await getContractById(companyId, contractId);

  const startDate = input.startDate ? new Date(input.startDate) : new Date(existing.startDate);
  const endDate = input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : existing.endDate ? new Date(existing.endDate) : null;

  if (endDate && startDate && endDate.getTime() < startDate.getTime()) {
    throw new AppError(400, 'INVALID_DATES', 'End date must be on or after start date');
  }

  const targetStatus = input.status || existing.status;
  const status = evaluateContractStatus(targetStatus, endDate);

  if (isDatabaseConnected) {
    try {
      const updated = await prisma.contract.update({
        where: { id: contractId },
        data: {
          subject: input.subject || existing.subject,
          customerId: input.customerId || existing.customerId,
          projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
          contractType: input.contractType || existing.contractType,
          value: input.value !== undefined ? roundMoney(input.value) : existing.value,
          currency: input.currency || existing.currency,
          status,
          startDate,
          endDate,
          description: input.description !== undefined ? input.description : existing.description,
          terms: input.terms !== undefined ? input.terms : existing.terms,
          attachmentUrl: input.attachmentUrl !== undefined ? input.attachmentUrl : existing.attachmentUrl,
        },
        include: { customer: true, project: true },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CONTRACT_UPDATED',
          entityType: 'Contract',
          entityId: contractId,
          metadata: { status, value: Number(updated.value) },
        },
      });

      return {
        ...updated,
        value: Number(updated.value),
        calculatedStatus: status,
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const storeCon = devStore.contracts.find((c) => c.id === contractId);
  if (!storeCon) throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');

  if (input.subject) storeCon.subject = input.subject;
  if (input.customerId) storeCon.customerId = input.customerId;
  if (input.projectId !== undefined) storeCon.projectId = input.projectId;
  if (input.contractType) storeCon.contractType = input.contractType;
  if (input.value !== undefined) storeCon.value = roundMoney(input.value);
  if (input.currency) storeCon.currency = input.currency;
  storeCon.status = status;
  storeCon.startDate = startDate;
  storeCon.endDate = endDate;
  if (input.description !== undefined) storeCon.description = input.description;
  if (input.terms !== undefined) storeCon.terms = input.terms;
  if (input.attachmentUrl !== undefined) storeCon.attachmentUrl = input.attachmentUrl;
  storeCon.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'CONTRACT_UPDATED',
    entityType: 'Contract',
    entityId: contractId,
    metadata: { status, value: storeCon.value },
    createdAt: new Date(),
  });

  return getContractById(companyId, contractId);
}

export async function archiveContract(companyId: string, contractId: string, actorId: string) {
  if (isDatabaseConnected) {
    try {
      await prisma.contract.update({
        where: { id: contractId },
        data: { isArchived: true },
      });
      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CONTRACT_ARCHIVED',
          entityType: 'Contract',
          entityId: contractId,
        },
      });
      return { success: true };
    } catch {
      // Fallback
    }
  }

  const storeCon = devStore.contracts.find((c) => c.id === contractId);
  if (!storeCon) throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  storeCon.isArchived = true;
  storeCon.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'CONTRACT_ARCHIVED',
    entityType: 'Contract',
    entityId: contractId,
    metadata: {},
    createdAt: new Date(),
  });

  return { success: true };
}
