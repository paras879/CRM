import crypto from 'node:crypto';
import path from 'node:path';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevAttachment } from '../../config/dev-store.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { AttachmentEntityType, ListAttachmentsQuery, UploadAttachmentQuery } from './attachments.schema.js';
import * as storage from './attachments.storage.js';

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.sh', '.js', '.mjs', '.vbs', '.jar', '.html', '.htm', '.svg',
]);

function sanitizeFileName(name: string) {
  const base = path.basename(name.replace(/\\/g, '/')).replace(/[^\w.\- ()]/g, '_').trim();
  return base || 'file';
}

async function assertEntityInCompany(companyId: string, entityType: AttachmentEntityType, entityId: string) {
  let found = false;

  if (!isDatabaseConnected) {
    switch (entityType) {
      case 'customer': found = devStore.customers.some((e) => e.id === entityId && e.companyId === companyId); break;
      case 'lead': found = devStore.leads.some((e) => e.id === entityId && e.companyId === companyId); break;
      case 'project': found = devStore.projects.some((e) => e.id === entityId && e.companyId === companyId); break;
      case 'task': {
        const task = devStore.tasks.find((e) => e.id === entityId);
        found = !!task && devStore.projects.some((p) => p.id === task.projectId && p.companyId === companyId);
        break;
      }
      case 'invoice': found = devStore.invoices.some((e) => e.id === entityId && e.companyId === companyId); break;
      case 'ticket': found = devStore.tickets.some((e) => e.id === entityId && e.companyId === companyId); break;
      case 'contract': found = devStore.contracts.some((e) => e.id === entityId && e.companyId === companyId); break;
      case 'proposal': found = devStore.proposals.some((e) => e.id === entityId && e.companyId === companyId); break;
      case 'estimate': found = devStore.estimates.some((e) => e.id === entityId && e.companyId === companyId); break;
    }
  } else {
    const where = { id: entityId, companyId };
    switch (entityType) {
      case 'customer': found = !!(await prisma.customer.findFirst({ where, select: { id: true } })); break;
      case 'lead': found = !!(await prisma.lead.findFirst({ where, select: { id: true } })); break;
      case 'project': found = !!(await prisma.project.findFirst({ where, select: { id: true } })); break;
      case 'task': found = !!(await prisma.task.findFirst({ where: { id: entityId, project: { companyId } }, select: { id: true } })); break;
      case 'invoice': found = !!(await prisma.invoice.findFirst({ where, select: { id: true } })); break;
      case 'ticket': found = !!(await prisma.ticket.findFirst({ where, select: { id: true } })); break;
      case 'contract': found = !!(await prisma.contract.findFirst({ where, select: { id: true } })); break;
      case 'proposal': found = !!(await prisma.proposal.findFirst({ where, select: { id: true } })); break;
      case 'estimate': found = !!(await prisma.estimate.findFirst({ where, select: { id: true } })); break;
    }
  }

  if (!found) {
    throw new AppError(404, 'ENTITY_NOT_FOUND', `The ${entityType} to attach to was not found.`);
  }
}

export async function listAttachments(companyId: string, query: ListAttachmentsQuery) {
  await assertEntityInCompany(companyId, query.entityType, query.entityId);

  if (!isDatabaseConnected) {
    return devStore.attachments
      .filter((a) => a.companyId === companyId && a.entityType === query.entityType && a.entityId === query.entityId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return prisma.attachment.findMany({
    where: { companyId, entityType: query.entityType, entityId: query.entityId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function uploadAttachment(
  companyId: string,
  actorId: string,
  query: UploadAttachmentQuery,
  mimeType: string,
  data: Buffer
) {
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'The uploaded file is empty.');
  }
  if (data.length > env.MAX_UPLOAD_MB * 1024 * 1024) {
    throw new AppError(413, 'FILE_TOO_LARGE', `Files must be ${env.MAX_UPLOAD_MB} MB or smaller.`);
  }

  const fileName = sanitizeFileName(query.fileName);
  if (BLOCKED_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
    throw new AppError(400, 'FILE_TYPE_NOT_ALLOWED', 'This file type is not allowed. Upload a document, image, archive or spreadsheet.');
  }

  await assertEntityInCompany(companyId, query.entityType, query.entityId);

  const id = crypto.randomUUID();
  const storageKey = `${companyId}/${id}`;
  await storage.writeFile(storageKey, data);

  const record = {
    id,
    companyId,
    entityType: query.entityType,
    entityId: query.entityId,
    fileName,
    mimeType: mimeType || 'application/octet-stream',
    sizeBytes: data.length,
    storageKey,
    uploadedById: actorId,
    createdAt: new Date(),
  };

  let saved: DevAttachment;
  if (!isDatabaseConnected) {
    devStore.attachments.unshift(record);
    saved = record;
  } else {
    try {
      saved = await prisma.attachment.create({ data: record });
    } catch (err) {
      await storage.removeFile(storageKey);
      throw err;
    }
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ATTACHMENT_UPLOADED',
    entityType: query.entityType,
    entityId: query.entityId,
    metadata: { attachmentId: id, fileName, sizeBytes: data.length },
  });

  return saved;
}

async function findOwned(companyId: string, attachmentId: string): Promise<DevAttachment> {
  const found = !isDatabaseConnected
    ? devStore.attachments.find((a) => a.id === attachmentId && a.companyId === companyId)
    : await prisma.attachment.findFirst({ where: { id: attachmentId, companyId } });

  if (!found) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
  }
  return found;
}

export async function getAttachmentFile(companyId: string, attachmentId: string) {
  const attachment = await findOwned(companyId, attachmentId);
  let data: Buffer;
  try {
    data = await storage.readFile(attachment.storageKey);
  } catch {
    throw new AppError(404, 'ATTACHMENT_FILE_MISSING', 'The stored file could not be found.');
  }
  return { attachment, data };
}

export async function deleteAttachment(companyId: string, actorId: string, attachmentId: string) {
  const attachment = await findOwned(companyId, attachmentId);

  if (!isDatabaseConnected) {
    devStore.attachments = devStore.attachments.filter((a) => a.id !== attachmentId);
  } else {
    await prisma.attachment.delete({ where: { id: attachmentId } });
  }
  await storage.removeFile(attachment.storageKey);

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ATTACHMENT_DELETED',
    entityType: attachment.entityType,
    entityId: attachment.entityId,
    metadata: { attachmentId, fileName: attachment.fileName },
  });
}
