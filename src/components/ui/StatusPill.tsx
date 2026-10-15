import { cn } from '@/lib/utils';

/* Single pill primitive for every status/tag in the app. Colour classes come
   from lib/status.ts so the palette lives in one place. */
export function StatusPill({
  children,
  color,
  size = 'md',
  icon,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        color ?? 'bg-gray-100 text-gray-600 border border-gray-300',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
