'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  CalendarDays,
  BarChart2,
  ClipboardList,
  Settings,
  LogOut,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const NAV = [
  { href: '/',                 label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/gantt',            label: 'Magneto Plan',     icon: CalendarDays    },
  { href: '/indicador',        label: 'Indicador Diario', icon: BarChart2       },
  { href: '/casos-pendientes', label: 'Casos Pendientes', icon: ClipboardList   },
  { href: '/configuracion',    label: 'Configuración',    icon: Settings        },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const { signOut, user, isAdmin } = useAuth();

  async function handleSignOut() {
    await signOut();
    toast.success('Sesión cerrada');
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col shrink-0 min-h-screen bg-[#1a1a2e] text-white',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Toggle button — floats on the right edge */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className="absolute -right-3 top-[26px] z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[#252545] border border-white/20 text-gray-400 hover:text-white shadow-lg transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className="flex h-[72px] items-center border-b border-white/10 px-3.5 overflow-hidden">
        <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
          <Wrench size={18} className="text-white" />
        </div>
        <div
          className={cn(
            'ml-3 overflow-hidden transition-all duration-300',
            collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100',
          )}
        >
          <p className="text-sm font-bold leading-tight whitespace-nowrap">Magneto Plan</p>
          <p className="text-xs text-blue-300 leading-tight whitespace-nowrap">BYD Hermosillo</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-xl text-sm font-medium transition-all duration-150',
                'px-3 py-2.5 gap-3',
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-gray-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap transition-all duration-300',
                  collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100',
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className={cn(
              'overflow-hidden transition-all duration-300 px-3 pt-4 pb-1',
              collapsed ? 'max-w-0 opacity-0' : 'opacity-100',
            )}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Admin</p>
            </div>
            <Link
              href="/admin/usuarios"
              title={collapsed ? 'Usuarios' : undefined}
              className={cn(
                'flex items-center rounded-xl text-sm font-medium transition-all duration-150',
                'px-3 py-2.5 gap-3',
                pathname.startsWith('/admin')
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-gray-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <ShieldCheck size={18} className="shrink-0" />
              <span className={cn(
                'overflow-hidden whitespace-nowrap transition-all duration-300',
                collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100',
              )}>
                Usuarios
              </span>
            </Link>
          </>
        )}
      </nav>

      {/* User / sign out */}
      <div className="px-2 py-4 border-t border-white/10">
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 px-3',
            collapsed ? 'max-h-0 opacity-0 mb-0' : 'max-h-10 opacity-100 mb-2',
          )}
        >
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-150"
        >
          <LogOut size={18} className="shrink-0" />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-all duration-300',
              collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100',
            )}
          >
            Cerrar sesión
          </span>
        </button>
      </div>
    </aside>
  );
}
