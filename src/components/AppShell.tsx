'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { useSearch } from '@/context/SearchContext';
import { Search, X, Wrench } from 'lucide-react';

// Routes where the search bar is hidden
const SEARCH_EXCLUDED = ['/configuracion', '/admin/usuarios', '/login'];

function SearchBar() {
  const pathname = usePathname();
  const { query, setQuery } = useSearch();

  if (SEARCH_EXCLUDED.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-3 shrink-0">
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cita, cliente, VIN, orden…"
          className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 bg-gray-50/80 placeholder:text-gray-400 shadow-[0_1px_2px_rgba(17,24,39,0.04)] transition-all hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/70"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#131627]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Wrench size={18} className="text-white" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300 text-sm font-medium">Cargando Magneto Plan…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || active === false) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0">
        <SearchBar />
        <main className="flex-1 overflow-auto bg-gray-50/60">
          {children}
        </main>
      </div>
    </div>
  );
}
