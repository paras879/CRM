'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { isFinanceUser, isManagerUser, isSupportUser } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // The admin console is not part of a Manager's, Finance user's or support agent's workspace.
  const blockedForManager = (isManagerUser(user) || isFinanceUser(user) || isSupportUser(user)) && pathname.startsWith('/admin');
  useEffect(() => {
    if (blockedForManager) router.replace('/dashboard');
  }, [blockedForManager, router]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-background text-foreground">
        {/* Desktop Sidebar */}
        <div className="hidden md:block shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-50 w-64 h-full bg-card shadow-2xl">
              <Sidebar />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            {blockedForManager ? null : children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
