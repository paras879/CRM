'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Layers, ShieldCheck, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { getDisplayName, getRoleNames } from '@/lib/utils';

export default function LoginPage() {
  const { login, logout, user, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Someone is already signed in on this browser. Do not bounce straight to their dashboard: that
  // makes it impossible to switch accounts, because the new credentials can never be entered.
  const signedInUser = !isLoading ? user : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Background ambient lighting effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none" />

      <ThemeToggle className="absolute top-4 right-4 z-20" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/25 mb-4">
            <Layers className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Business CRM Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Enterprise Management CRM & Operations Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-8 shadow-2xl">
          {signedInUser ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                {getDisplayName(signedInUser).charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">You are already signed in</h2>
                <p className="text-sm text-foreground mt-1 font-medium">{getDisplayName(signedInUser)}</p>
                <p className="text-xs text-muted-foreground">{signedInUser.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{getRoleNames(signedInUser).join(', ')}</p>
              </div>
              <div className="space-y-2">
                <Button type="button" className="w-full font-medium" onClick={() => router.push('/dashboard')}>
                  <span>Continue to dashboard</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" className="w-full font-medium" onClick={() => logout()}>
                  Sign out and use a different account
                </Button>
              </div>
            </div>
          ) : (
            <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Sign In</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your corporate credentials to access your workspace
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-5 text-xs">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
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
            </div>

            <div>
              <Input
                label="Password"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure Session
              </span>
              <Link href="/forgot-password" className="text-[11px] text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full mt-2 font-medium"
              isLoading={isSubmitting}
            >
              <span>Authenticate</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
            </>
          )}
        </div>

        <div className="text-center mt-6 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Business CRM Blueprint &bull; All rights reserved.
        </div>
      </div>
    </div>
  );
}
