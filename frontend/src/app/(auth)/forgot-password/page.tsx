'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/25 mb-4">
            <Layers className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot password</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Your administrator can create a one-time reset link for you.
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/80 p-8 shadow-2xl">
          {message && (
            <Alert variant="success" className="mb-5 text-xs">
              {message}
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mb-5 text-xs">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoComplete="email"
            />
            <Button type="submit" className="w-full font-medium" isLoading={isSubmitting}>
              Request Reset Link
            </Button>
          </form>

          <Link href="/login" className="mt-5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
