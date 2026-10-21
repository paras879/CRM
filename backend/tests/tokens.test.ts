import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRandomToken,
  hashToken,
} from '../src/utils/tokens.js';

describe('Tokens Utility', () => {
  it('generates and verifies JWT access token', () => {
    const payload = {
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'user@example.com',
      companyId: '00000000-0000-0000-0000-000000000001',
    };

    const token = generateAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.companyId).toBe(payload.companyId);
  });

  it('generates cryptographically secure random token and SHA-256 hash', () => {
    const token1 = generateRandomToken(32);
    const token2 = generateRandomToken(32);

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes in hex = 64 chars

    const hash1 = hashToken(token1);
    const hash2 = hashToken(token1);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashToken(token2));
  });
});
