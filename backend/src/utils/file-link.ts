import { z } from 'zod';

/** Files uploaded through the app are served from here, e.g. /api/v1/uploads/<uuid>. */
const UPLOAD_LINK = /^\/api\/v1\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUploadLink(value: string): boolean {
  return UPLOAD_LINK.test(value);
}

/** A link to a file: either a file uploaded in the app, or an external http(s) address. */
export const fileLinkSchema = z
  .string()
  .max(2048)
  .refine(
    (value) => {
      if (isUploadLink(value)) return true;
      try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'Must be an uploaded file or a valid web address' }
  );
