'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  role?: string;
}

export function ProtectedRoute({ children, permission, role }: ProtectedRouteProps) {
  const { user, isLoading, hasPermission, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6 bg-background">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You do not possess the required permission (<code className="font-mono text-xs">{permission}</code>) to view this page.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (role && !hasRole(role)) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6 bg-background">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You must be an active member of role <code className="font-mono text-xs">{role}</code> to view this section.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
