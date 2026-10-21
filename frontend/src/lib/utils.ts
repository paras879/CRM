import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatCurrency(amount: number | string, currency = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

/**
 * Sum amounts per currency and format them together, e.g. "₹1,20,000.00 + $500.00". Amounts in
 * different currencies are never added to each other.
 */
export function formatCurrencyTotals<T>(
  items: T[],
  getAmount: (item: T) => number,
  getCurrency: (item: T) => string | undefined,
  fallbackCurrency = 'INR'
): string {
  const totals = new Map<string, number>();
  for (const item of items) {
    const currency = getCurrency(item) || fallbackCurrency;
    totals.set(currency, (totals.get(currency) ?? 0) + (getAmount(item) || 0));
  }
  if (totals.size === 0) return formatCurrency(0, fallbackCurrency);
  return Array.from(totals, ([currency, total]) => formatCurrency(total, currency)).join(' + ');
}

/**
 * Name to show for the signed-in account. Seeded accounts are named after their
 * role ("Staff Member"), which reads like a duplicate of the role badge, so fall
 * back to the part of the email the user logged in with ("staff@test.com" -> "Staff").
 */
export function getDisplayName(user: { name?: string | null; email?: string | null; roles?: unknown[] } | null | undefined): string {
  if (!user) return '';
  const roleNames = (user.roles ?? []).map((r: any) => (typeof r === 'string' ? r : r?.name));
  const name = user.name?.trim();
  if (name && !roleNames.includes(name)) return name;
  const local = user.email?.split('@')[0] ?? '';
  const pretty = local.replace(/[._-]+/g, ' ').trim();
  return pretty ? pretty.replace(/\b\w/g, (c) => c.toUpperCase()) : name || '';
}

export function getRoleNames(user: { roles?: unknown[] } | null | undefined): string[] {
  return (user?.roles ?? []).map((r: any) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
}

/** A Manager who is not also an Administrator: sees a team-focused workspace, not the admin console. */
export function isManagerUser(user: { roles?: unknown[] } | null | undefined): boolean {
  const roles = getRoleNames(user);
  return roles.includes('Manager') && !roles.includes('Administrator');
}

/** A Finance User who is not also an Administrator: sees a billing-focused workspace. */
export function isFinanceUser(user: { roles?: unknown[] } | null | undefined): boolean {
  const roles = getRoleNames(user);
  return roles.includes('Finance User') && !roles.includes('Administrator');
}

/** A support agent ("Support Specialist", or "Support User" in the seeded database) who is not an Administrator. */
export function isSupportUser(user: { roles?: unknown[] } | null | undefined): boolean {
  const roles = getRoleNames(user);
  return (roles.includes('Support Specialist') || roles.includes('Support User')) && !roles.includes('Administrator');
}
