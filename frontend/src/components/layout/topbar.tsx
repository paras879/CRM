'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../auth/auth-provider';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getDisplayName, getRoleNames, isFinanceUser, isManagerUser, isSupportUser } from '@/lib/utils';
import { ThemeToggle } from '../theme/theme-toggle';
import {
  Bell,
  Search,
  LogOut,
  User as UserIcon,
  Shield,
  ShieldCheck,
  Building,
  Menu,
  ChevronDown,
  LayoutDashboard,
  Settings,
  History,
  Loader2,
} from 'lucide-react';

interface TopbarProps {
  onMobileMenuToggle?: () => void;
  title?: string;
}

export function Topbar({ onMobileMenuToggle, title }: TopbarProps) {
  const { user, logout } = useAuth();
  const isAdmin = getRoleNames(user).includes('Administrator');
  const resolvedTitle =
    title ?? (isAdmin ? 'Admin Console' : isManagerUser(user) ? 'Manager Workspace' : isFinanceUser(user) ? 'Finance Workspace' : isSupportUser(user) ? 'Support Workspace' : 'Staff Workspace');
  const displayName = getDisplayName(user);
  const headerRef = React.useRef<HTMLElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications/unread-count', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.data?.unreadCount ?? 0);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = React.useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const res = await fetch('/api/v1/notifications?limit=8', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Close either dropdown on any click outside the header, or on Escape.
  React.useEffect(() => {
    if (!profileOpen && !notifOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen, notifOpen]);

  const handleOpenNotifs = () => {
    if (!notifOpen) {
      fetchNotifications();
    }
    setNotifOpen(!notifOpen);
    setProfileOpen(false);
  };

  const handleMarkAsRead = async (id: string, link?: string | null) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (link) {
        window.location.href = link;
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/v1/notifications/mark-all-read', {
        method: 'PATCH',
        credentials: 'include',
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const primaryRole =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? typeof user.roles[0] === 'string'
        ? user.roles[0]
        : (user.roles[0] as any).name
      : 'User';

  return (
    <header ref={headerRef} className="h-16 border-b border-border/70 bg-background/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-4">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">{resolvedTitle}</h1>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Company Badge */}
        {user?.company && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground font-medium border border-border/50">
            <Building className="h-3.5 w-3.5" />
            <span>{user.company.name}</span>
          </div>
        )}

        <ThemeToggle />

        {/* Real In-App Notification Center Dropdown */}
        <div className="relative">
          <button
            onClick={handleOpenNotifs}
            className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-primary rounded-full px-1 shadow-sm animate-in zoom-in-50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card p-0 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                  {loadingNotifs ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No notifications yet. You are completely caught up!
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isUnread = !n.readAt;
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id, n.link)}
                          className={`p-3 text-left transition-colors cursor-pointer hover:bg-muted/50 ${
                            isUnread ? 'bg-primary/[0.04]' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground leading-tight">
                              {n.title}
                            </span>
                            {isUnread && (
                              <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {n.body}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground/80">
                            <span className="capitalize">{String(n.type).replace(/[._]/g, ' ')}</span>
                            <span>{new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label="Account menu"
            className="flex items-center gap-2.5 p-1 pr-2 rounded-lg hover:bg-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground font-semibold flex items-center justify-center text-xs shadow-sm">
              {displayName.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold leading-tight">{displayName}</span>
              <span className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-primary" />
                {primaryRole}
              </span>
            </div>
            <ChevronDown
              className={`hidden md:block h-3.5 w-3.5 text-muted-foreground transition-transform ${profileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {profileOpen && (
            <div
              role="menu"
              aria-label="Account"
              className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-card shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 overflow-hidden"
            >
              {/* Who is signed in */}
              <div className="flex items-center gap-3 px-4 py-4 bg-gradient-to-br from-primary/10 via-transparent to-transparent border-b border-border/60">
                <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground font-bold flex items-center justify-center text-base shadow-sm">
                  {displayName.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate" title={user?.email}>
                    {user?.email}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {getRoleNames(user).map((role) => (
                      <Badge key={role} variant="secondary" className="text-[10px] py-0 px-1.5">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Workspace facts */}
              <dl className="px-4 py-3 space-y-2 text-xs border-b border-border/60">
                {user?.company?.name && (
                  <div className="flex items-center gap-2.5">
                    <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <dt className="text-muted-foreground">Company</dt>
                    <dd className="ml-auto font-medium text-foreground truncate">{user.company.name}</dd>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <dt className="text-muted-foreground">Access</dt>
                  <dd className="ml-auto font-medium text-foreground">
                    {isAdmin ? 'Full access' : `${user?.permissions?.length || 0} permissions`}
                  </dd>
                </div>
              </dl>

              {/* Shortcuts */}
              <div className="p-1.5">
                <Link
                  href="/dashboard"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground rounded-md hover:bg-muted/70 transition-colors focus:outline-none focus:bg-muted/70"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                  Dashboard
                </Link>
                {isAdmin && (
                  <>
                    <Link
                      href="/admin/settings"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground rounded-md hover:bg-muted/70 transition-colors focus:outline-none focus:bg-muted/70"
                    >
                      <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      Company settings
                    </Link>
                    <Link
                      href="/admin/audit-logs"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground rounded-md hover:bg-muted/70 transition-colors focus:outline-none focus:bg-muted/70"
                    >
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                      Audit logs
                    </Link>
                  </>
                )}
              </div>

              {/* Sign out */}
              <div className="p-1.5 border-t border-border/60">
                <button
                  role="menuitem"
                  disabled={signingOut}
                  onClick={async () => {
                    setSigningOut(true);
                    try {
                      await logout();
                    } finally {
                      setSigningOut(false);
                      setProfileOpen(false);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-md transition-colors focus:outline-none focus:bg-destructive/10 disabled:opacity-60"
                >
                  {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
