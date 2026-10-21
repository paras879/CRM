import crypto from 'node:crypto';
import path from 'node:path';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import * as storage from '../attachments/attachments.storage.js';

/** Same blocklist as record attachments: nothing that a browser or the OS would run. */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.sh', '.js', '.mjs', '.vbs', '.jar', '.html', '.htm', '.svg',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

/** Types a browser can safely show in place; everything else is downloaded. */
const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const SEPARATOR = '__';

function sanitizeFileName(name: string) {
  const base = path.basename(name.replace(/\\/g, '/')).replace(/[^\w.\- ()]/g, '_').trim();
  return base || 'file';
}

const uploadDir = (companyId: string) => `${companyId}/uploads`;

export async function saveUpload(companyId: string, fileNameInput: string, data: Buffer) {
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'The uploaded file is empty.');
  }
  if (data.length > env.MAX_UPLOAD_MB * 1024 * 1024) {
    throw new AppError(413, 'FILE_TOO_LARGE', `Files must be ${env.MAX_UPLOAD_MB} MB or smaller.`);
  }

  const fileName = sanitizeFileName(fileNameInput);
  if (BLOCKED_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
    throw new AppError(400, 'FILE_TYPE_NOT_ALLOWED', 'This file type is not allowed. Upload a document, image, archive or spreadsheet.');
  }

  const id = crypto.randomUUID();
  await storage.writeFile(`${uploadDir(companyId)}/${id}${SEPARATOR}${fileName}`, data);

  return { id, url: `/api/v1/uploads/${id}`, fileName, sizeBytes: data.length };
}

export async function readUpload(companyId: string, id: string) {
  const key = await storage.findKeyByPrefix(uploadDir(companyId), `${id}${SEPARATOR}`);
  if (!key) {
    throw new AppError(404, 'UPLOAD_NOT_FOUND', 'File not found.');
  }
  const fileName = path.basename(key).slice(id.length + SEPARATOR.length);
  const mimeType = MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
  return { fileName, mimeType, inline: INLINE_TYPES.has(mimeType), data: await storage.readFile(key) };
}
