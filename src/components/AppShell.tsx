'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { useSearch } from '@/context/SearchContext';
import { MagnifyingGlass, X, Wrench } from '@phosphor-icons/react';

// Routes where the search bar is hidden
const SEARCH_EXCLUDED = ['/configuracion', '/admin/usuarios', '/login'];

function SearchBar() {
  const pathname = usePathname();
  const { query, setQuery } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const hidden = SEARCH_EXCLUDED.some((p) => pathname.startsWith(p));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (hidden) return null;

  return (
    <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-line px-6 py-3 shrink-0">
      <div className="relative max-w-md">
        <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cita, cliente, VIN, orden…"
          className="w-full pl-9 pr-16 py-2 rounded-xl border border-line text-sm text-gray-800 bg-surface-muted/70 placeholder:text-gray-500 shadow-[var(--shadow-card)] transition-all hover:bg-surface focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500/70"
        />
        {query ? (
          <button
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        )}
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, active, loading } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  useEffect(() => {
    if (!loading && (!user || active === false)) router.replace('/login');
  }, [user, active, loading, router]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 bg-ink">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-accent-600 flex items-center justify-center">
            <Wrench size={18} className="text-white" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300 text-sm font-medium">Cargando Magneto Plan…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || active === false) return null;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <SearchBar />
        <main className="flex-1 overflow-y-auto bg-paper">
          {children}
        </main>
      </div>
    </div>
  );
}
