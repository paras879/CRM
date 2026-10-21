import { describe, it, expect } from 'vitest';
import { loginSchema, resetPasswordSchema } from '../src/modules/auth/auth.schema.js';
import { createUserSchema } from '../src/modules/users/users.schema.js';
import { createRoleSchema } from '../src/modules/roles/roles.schema.js';

describe('Zod Validation Schemas', () => {
  describe('Login Schema', () => {
    it('normalizes email and accepts valid credentials', () => {
      const res = loginSchema.safeParse({
        email: '  USER@Example.COM  ',
        password: 'anyPassword123',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.email).toBe('user@example.com');
      }
    });

    it('rejects invalid email', () => {
      const res = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('Reset Password Schema', () => {
    it('enforces strong password policy', () => {
      // Missing number
      expect(
        resetPasswordSchema.safeParse({ token: '1234567890123456', newPassword: 'PasswordNoNumber' }).success
      ).toBe(false);

      // Missing uppercase
      expect(
        resetPasswordSchema.safeParse({ token: '1234567890123456', newPassword: 'password123' }).success
      ).toBe(false);

      // Valid strong password
      expect(
        resetPasswordSchema.safeParse({ token: '1234567890123456', newPassword: 'StrongPassword123' }).success
      ).toBe(true);
    });
  });

  describe('Create User Schema', () => {
    it('validates user fields and role IDs format', () => {
      const valid = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password123!',
        roleIds: ['11111111-1111-1111-1111-111111111111'],
      };
      expect(createUserSchema.safeParse(valid).success).toBe(true);

      const invalidRoles = {
        ...valid,
        roleIds: ['not-a-uuid'],
      };
      expect(createUserSchema.safeParse(invalidRoles).success).toBe(false);
    });
  });

  describe('Create Role Schema', () => {
    it('requires name and at least one permission', () => {
      expect(createRoleSchema.safeParse({ name: 'R', permissionKeys: ['users.view'] }).success).toBe(false);
      expect(createRoleSchema.safeParse({ name: 'Valid Role', permissionKeys: [] }).success).toBe(false);
      expect(
        createRoleSchema.safeParse({ name: 'Valid Role', permissionKeys: ['users.view'] }).success
      ).toBe(true);
    });
  });
});
