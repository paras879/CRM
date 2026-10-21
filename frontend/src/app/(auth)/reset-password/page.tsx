'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Layers } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details) && err.details.length > 0) {
        setError(String((err.details[0] as { message?: string }).message ?? err.message));
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not reset the password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <Alert variant="destructive" className="text-xs">
        This reset link is incomplete. Ask your administrator for a new one.
      </Alert>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert variant="success" className="text-xs">
          Your password has been reset. You can now sign in with the new password.
        </Alert>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-5 text-xs">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New password"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <p className="text-xs text-muted-foreground">At least 8 characters with an uppercase letter, a lowercase letter and a number.</p>
        <Input
          label="Confirm new password"
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Button type="submit" className="w-full font-medium" isLoading={isSubmitting}>
          Reset Password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/25 mb-4">
            <Layers className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset password</h1>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card/80 p-8 shadow-2xl">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
