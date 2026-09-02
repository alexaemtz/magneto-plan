'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Card container ──────────────────────────────────────────────────────────
   Single source for the app's surface treatment. Use instead of hand-writing
   `bg-white rounded-xl border ... shadow-sm` everywhere. */
export function Card({
  className,
  children,
  as: Tag = 'div',
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(
        'bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_2px_rgba(17,24,39,0.04)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ── Page header ───────────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-gray-900">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-gray-500 mt-1.5 max-w-[65ch]">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3 flex-wrap shrink-0">{children}</div>}
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  valueClassName,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'violet';
  valueClassName?: string;
  /** Only pass this when there is a real comparison value — never fabricate a trend. */
  trend?: { direction: 'up' | 'down'; label: string };
}) {
  const ICON_BG: Record<NonNullable<typeof tone>, string> = {
    default: 'bg-gray-400',
    accent:  'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger:  'bg-red-500',
    violet:  'bg-violet-500',
  };

  return (
    <div className="bg-white rounded-[28px] border border-gray-200/70 shadow-[0_1px_3px_rgba(17,24,39,0.06)] px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 pt-1.5">{label}</p>
        {icon && (
          <span className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0', ICON_BG[tone])}>
            {icon}
          </span>
        )}
      </div>
      <p className={cn('text-[26px] font-bold leading-none tracking-tight text-gray-900 tabular mt-3.5', valueClassName)}>
        {value}
      </p>
      {(trend || sub) && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {trend && (
            <span className={cn(
              'flex items-center gap-0.5 text-xs font-bold shrink-0',
              trend.direction === 'up' ? 'text-emerald-600' : 'text-red-500',
            )}>
              {trend.direction === 'up' ? <ArrowUp size={12} strokeWidth={2.5} /> : <ArrowDown size={12} strokeWidth={2.5} />}
              {trend.label}
            </span>
          )}
          {sub && <span className="text-xs text-gray-400 truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Skeleton loader ───────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-gray-200/70', className)} />;
}

/* Table skeleton that mirrors the real row layout */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn('h-3.5', c === 0 ? 'w-24' : 'flex-1', r % 2 === 0 && c % 2 === 1 && 'opacity-60')}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Empty / error states ──────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('px-6 py-14 flex flex-col items-center justify-center text-center', className)}>
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
