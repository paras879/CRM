'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/auth-provider';
import { cn, getDisplayName, getRoleNames, isFinanceUser, isManagerUser, isSupportUser } from '@/lib/utils';
import {
  CalendarClock,
  TrendingUp,
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  CheckSquare,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  Wallet,
  LifeBuoy,
  ShieldCheck,
  History,
  Shield,
  Layers,
  ChevronRight,
  BookOpen,
  BarChart3,
  Settings,
  Repeat,
  UsersRound,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { hasPermission, user } = useAuth();
  const isManager = isManagerUser(user);
  const isFinance = isFinanceUser(user);
  const isSupport = isSupportUser(user);
  const isAdmin = getRoleNames(user).includes('Administrator');

  // Managers run a team: delivery, sales and support. Finance and system administration stay with other roles.
  const MANAGER_HIDDEN_GROUPS = ['Finance', 'Administration'];

  const allNavGroups: NavGroup[] = [
    {
      label: 'Core',
      items: [
        {
          title: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
          permission: 'dashboard.view',
        },
        ...(isManager
          ? [
              {
                title: 'My Team',
                href: '/team',
                icon: UsersRound,
                permission: 'dashboard.view',
              },
            ]
          : []),
      ],
    },
    {
      label: 'CRM',
      items: [
        {
          title: 'CRM Dashboard',
          href: '/crm/dashboard',
          icon: TrendingUp,
          permission: 'leads.view',
        },
        {
          title: 'Leads',
          href: '/crm/leads',
          icon: Users,
          permission: 'leads.view',
        },
        {
          title: 'Customers',
          href: '/crm/customers',
          icon: Building2,
          permission: 'customers.view',
        },
        {
          title: 'Activities',
          href: '/crm/activities',
          icon: CalendarClock,
          permission: 'leads.view',
        },
      ],
    },
    {
      label: 'Work',
      items: [
        {
          title: 'Projects',
          href: '/work/projects',
          icon: Briefcase,
          permission: 'projects.view',
        },
        {
          title: 'Tasks',
          href: '/work/tasks',
          icon: CheckSquare,
          permission: 'tasks.view',
        },
      ],
    },
    {
      label: 'Sales',
      items: [
        {
          title: 'Proposals',
          href: '/sales/proposals',
          icon: FileSpreadsheet,
          permission: 'proposals.view',
        },
        {
          title: 'Estimates',
          href: '/sales/estimates',
          icon: Layers,
          permission: 'estimates.view',
        },
        {
          title: 'Contracts',
          href: '/sales/contracts',
          icon: Shield,
          permission: 'contracts.view',
        },
      ],
    },
    {
      label: 'Finance',
      items: [
        // Finance users land on this overview from Dashboard, so the duplicate entry is hidden for them.
        ...(isFinance
          ? []
          : [
              {
                title: 'Finance Overview',
                href: '/finance/dashboard',
                icon: TrendingUp,
                permission: 'invoices.view',
              },
            ]),
        {
          title: 'Invoices',
          href: '/finance/invoices',
          icon: Receipt,
          permission: 'invoices.view',
        },
        {
          title: 'Recurring Invoices',
          href: '/finance/recurring-invoices',
          icon: Repeat,
          permission: 'invoices.view',
        },
        {
          title: 'Payments',
          href: '/finance/payments',
          icon: CreditCard,
          permission: 'payments.view',
        },
        {
          title: 'Expenses',
          href: '/finance/expenses',
          icon: Wallet,
          permission: 'expenses.view',
        },
      ],
    },
    {
      label: 'Support & Docs',
      items: [
        {
          title: 'Support Desk',
          href: '/support/tickets',
          icon: LifeBuoy,
          permission: 'tickets.view',
        },
        {
          title: 'Knowledge Base',
          href: '/knowledge-base',
          icon: BookOpen,
          permission: 'kb.view',
        },
      ],
    },
    {
      label: 'Analytics',
      items: [
        {
          title: 'Reports & Export',
          href: '/reports',
          icon: BarChart3,
          permission: 'reports.view',
        },
      ],
    },
    {
      label: 'Administration',
      items: [
        {
          title: 'Staff Users',
          href: '/admin/users',
          icon: Users,
          permission: 'users.view',
        },
        {
          title: 'Roles & Permissions',
          href: '/admin/roles',
          icon: ShieldCheck,
          permission: 'roles.view',
        },
        {
          title: 'Company Settings',
          href: '/admin/settings',
          icon: Settings,
          permission: 'company.view',
        },
        {
          title: 'Audit Logs',
          href: '/admin/audit-logs',
          icon: History,
          permission: 'audit.view',
        },
      ],
    },
  ];

  // Finance users work in billing all day, so Finance sits right under Dashboard.
  // Support agents live in the ticket queue, so Support & Docs goes right under Dashboard.
  // Administrators run the system itself, so Administration sits right under Dashboard.
  const leadGroup = isAdmin ? 'Administration' : isFinance ? 'Finance' : isSupport ? 'Support & Docs' : null;
  const navGroups = leadGroup
    ? [
        ...allNavGroups.filter((g) => g.label === 'Core'),
        ...allNavGroups.filter((g) => g.label === leadGroup),
        ...allNavGroups.filter((g) => !['Core', leadGroup].includes(g.label)),
      ]
    : allNavGroups;

  return (
    <aside
      className={cn(
        'w-64 border-r border-border/70 bg-card/60 backdrop-blur-xl flex flex-col h-screen sticky top-0',
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-border/70 gap-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center text-primary-foreground shadow-md">
          <Layers className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
            Business CRM
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-mono font-semibold">
              v1.0
            </span>
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
            {user?.company?.name || 'CRM Workspace'}
          </span>
        </div>
      </div>

      {/* Navigation scroll area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups
          .filter((group) => !(isManager && MANAGER_HIDDEN_GROUPS.includes(group.label)))
          .map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-1">
              <h4 className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h4>
              <div className="space-y-0.5 pt-1">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors group',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            'h-4 w-4 transition-transform group-hover:scale-110',
                            isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                          )}
                        />
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded font-mono font-normal',
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Footer Card */}
      <div className="p-3 border-t border-border/70">
        <div className="rounded-lg bg-muted/40 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {getDisplayName(user).charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-medium text-foreground truncate">
                {getDisplayName(user)}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {Array.isArray(user?.roles) && user.roles.length > 0
                  ? typeof user.roles[0] === 'string'
                    ? user.roles[0]
                    : (user.roles[0] as any).name
                  : 'Staff'}
              </span>
            </div>
          </div>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Active Session" />
        </div>
      </div>
    </aside>
  );
}
