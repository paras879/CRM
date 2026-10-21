import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

describe('Password Utility', () => {
  it('hashes plain password and verifies matching password', async () => {
    const raw = 'StrongP@ssw0rd123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await verifyPassword(raw, hash);
    expect(isMatch).toBe(true);
  });

  it('rejects incorrect password against hash', async () => {
    const raw = 'StrongP@ssw0rd123!';
    const hash = await hashPassword(raw);

    const isMatch = await verifyPassword('WrongPassword', hash);
    expect(isMatch).toBe(false);
  });
});
