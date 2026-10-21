import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiFetch = vi.fn();
let token: string | null = 'reset-token-abc';

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => (key === 'token' ? token : null) }),
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return { apiFetch: (...args: unknown[]) => apiFetch(...args), ApiError };
});

import ResetPasswordPage from '@/app/(auth)/reset-password/page';
import { ApiError } from '@/lib/api';

describe('Reset password page', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    token = 'reset-token-abc';
  });

  it('explains when the link has no token', () => {
    token = null;
    render(<ResetPasswordPage />);
    expect(screen.getByText(/reset link is incomplete/i)).toBeInTheDocument();
  });

  it('blocks mismatched passwords without calling the API', async () => {
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText('New password'), 'Fresh1234Pass');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different1234');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('submits the token with the new password and confirms success', async () => {
    apiFetch.mockResolvedValueOnce({ message: 'ok' });
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText('New password'), 'Fresh1234Pass');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Fresh1234Pass');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => expect(screen.getByText(/your password has been reset/i)).toBeInTheDocument());
    const [url, init] = apiFetch.mock.calls[0];
    expect(url).toBe('/auth/reset-password');
    expect(JSON.parse(init.body)).toEqual({ token: 'reset-token-abc', newPassword: 'Fresh1234Pass' });
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute('href', '/login');
  });

  it('shows the first validation message from the server', async () => {
    apiFetch.mockRejectedValueOnce(
      new ApiError(400, 'VALIDATION_ERROR', 'Invalid request data', [
        { field: 'newPassword', message: 'Password must contain at least one number' },
      ])
    );
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText('New password'), 'NoNumbersHere');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NoNumbersHere');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Password must contain at least one number')).toBeInTheDocument();
  });

  it('shows the expiry message for a used or expired link', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired.'));
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText('New password'), 'Fresh1234Pass');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Fresh1234Pass');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
  });
});
