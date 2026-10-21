import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { CustomerType, CustomerStatus } from '@prisma/client';

type AttachmentsService = typeof import('../src/modules/attachments/attachments.service.js');
type CustomersService = typeof import('../src/modules/customers/customers.service.js');
type DevStoreModule = typeof import('../src/config/dev-store.js');

describe('Attachments Service', () => {
  let attachments: AttachmentsService;
  let customers: CustomersService;
  let devStore: DevStoreModule['devStore'];
  let uploadDir: string;
  let companyId: string;
  let adminId: string;
  let customerId: string;

  beforeAll(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    attachments = await import('../src/modules/attachments/attachments.service.js');
    customers = await import('../src/modules/customers/customers.service.js');
    devStore = (await import('../src/config/dev-store.js')).devStore;
    companyId = devStore.company.id;
    adminId = devStore.users[0].id;
  });

  afterAll(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    devStore.customers = [];
    devStore.contacts = [];
    devStore.notes = [];
    devStore.attachments = [];
    const customer = await customers.createCustomer(companyId, adminId, {
      type: CustomerType.COMPANY,
      name: 'Attachment Test Customer',
      email: `attach-${crypto.randomUUID()}@example.test`,
      status: CustomerStatus.ACTIVE,
    } as any);
    customerId = customer.id;
  });

  const query = (fileName: string, id?: string) => ({
    entityType: 'customer' as const,
    entityId: id ?? customerId,
    fileName,
  });

  it('uploads, lists, downloads and deletes a file', async () => {
    const body = Buffer.from('hello attachment');
    const saved = await attachments.uploadAttachment(companyId, adminId, query('notes.txt'), 'text/plain', body);
    expect(saved.fileName).toBe('notes.txt');
    expect(saved.sizeBytes).toBe(body.length);

    const list = await attachments.listAttachments(companyId, { entityType: 'customer', entityId: customerId });
    expect(list).toHaveLength(1);

    const file = await attachments.getAttachmentFile(companyId, saved.id);
    expect(file.data.equals(body)).toBe(true);

    await attachments.deleteAttachment(companyId, adminId, saved.id);
    const after = await attachments.listAttachments(companyId, { entityType: 'customer', entityId: customerId });
    expect(after).toHaveLength(0);
    await expect(attachments.getAttachmentFile(companyId, saved.id)).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });
  });

  it('strips path segments from file names', async () => {
    const saved = await attachments.uploadAttachment(
      companyId,
      adminId,
      query('..\\..\\secret/evil.txt'),
      'text/plain',
      Buffer.from('x')
    );
    expect(saved.fileName).toBe('evil.txt');
  });

  it('rejects executable and empty uploads', async () => {
    await expect(
      attachments.uploadAttachment(companyId, adminId, query('run.exe'), 'application/octet-stream', Buffer.from('x'))
    ).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });

    await expect(
      attachments.uploadAttachment(companyId, adminId, query('empty.txt'), 'text/plain', Buffer.alloc(0))
    ).rejects.toMatchObject({ code: 'EMPTY_FILE' });
  });

  it('rejects uploads to records that do not exist in the company', async () => {
    await expect(
      attachments.uploadAttachment(companyId, adminId, query('a.txt', crypto.randomUUID()), 'text/plain', Buffer.from('x'))
    ).rejects.toMatchObject({ code: 'ENTITY_NOT_FOUND' });
  });

  it('does not expose attachments to another company', async () => {
    const saved = await attachments.uploadAttachment(companyId, adminId, query('a.txt'), 'text/plain', Buffer.from('x'));
    await expect(attachments.getAttachmentFile(crypto.randomUUID(), saved.id)).rejects.toMatchObject({
      code: 'ATTACHMENT_NOT_FOUND',
    });
  });
});
