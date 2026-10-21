import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email('Valid email is required')),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email('Valid email is required')),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16, 'Valid reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
