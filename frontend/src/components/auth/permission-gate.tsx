'use client';

import React from 'react';
import { useAuth } from './auth-provider';

interface PermissionGateProps {
  permission?: string;
  role?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  permission,
  role,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasRole } = useAuth();

  let isAllowed = true;

  if (permission && !hasPermission(permission)) {
    isAllowed = false;
  }

  if (role && !hasRole(role)) {
    isAllowed = false;
  }

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
