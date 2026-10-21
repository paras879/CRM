import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';

const root = path.resolve(env.UPLOAD_DIR);

function resolveKey(storageKey: string) {
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return full;
}

export async function writeFile(storageKey: string, data: Buffer) {
  const full = resolveKey(storageKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function readFile(storageKey: string) {
  return fs.readFile(resolveKey(storageKey));
}

export async function removeFile(storageKey: string) {
  await fs.rm(resolveKey(storageKey), { force: true });
}

/** The key of the first file in `dirKey` whose name starts with `prefix`, if any. */
export async function findKeyByPrefix(dirKey: string, prefix: string): Promise<string | null> {
  const dir = resolveKey(dirKey);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }
  const match = names.find((name) => name.startsWith(prefix));
  return match ? `${dirKey}/${match}` : null;
}
