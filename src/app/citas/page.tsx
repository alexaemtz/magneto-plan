'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import AppointmentTable from '@/components/AppointmentTable';
import { Appointment } from '@/types';
import { getAllAppointments } from '@/lib/firestore/appointments';
import { useSearch } from '@/context/SearchContext';
import { PageHeader, Skeleton } from '@/components/ui/primitives';
import { CaretLeft, CaretRight, CaretDoubleLeft, CaretDoubleRight } from '@phosphor-icons/react';
import { SERVICE_LABELS, cn } from '@/lib/utils';

const PAGE_SIZES = [5, 10, 15, 20, 50, 100] as const;

export default function CitasPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [pageSize, setPageSize]         = useState(20);
  const { query }                       = useSearch();

  useEffect(() => {
    let cancelled = false;
    getAllAppointments().then((data) => {
      if (!cancelled) { setAppointments(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  function handleRefresh() {
    getAllAppointments().then(setAppointments);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return appointments;
    if (q === 'campaña' || q === 'campana') return appointments.filter((a) => a.campaña === true);
    return appointments.filter((a) =>
      [a.clientName, a.advisor, a.tecnico, a.carModel, a.serialNumber, a.workOrder,
       a.date, a.startTime, SERVICE_LABELS[a.serviceType], a.status]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [appointments, query]);

  const selectCls = 'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-400';

  return (
    <AppShell>
      <div className="px-6 py-7 space-y-4 max-w-screen-2xl mx-auto">
        <PageHeader
          title="Todas las Citas"
          description="Búsqueda general en todo el historial de citas"
        />

        {loading ? (
          <Skeleton className="h-[440px] w-full rounded-2xl" />
        ) : (
          <AppointmentTable
            appointments={filtered}
            onRefresh={handleRefresh}
            searchQuery=""
            pageSize={pageSize}
            exportable
            renderFooter={(t) => (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{t.filteredRows.length} resultado{t.filteredRows.length !== 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Mostrar:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className={selectCls}
                    >
                      {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500 mr-2">Página {t.safePage} de {t.totalPages}</span>

                  <NavBtn onClick={() => t.setCurrentPage(1)} disabled={t.safePage === 1} title="Primera">
                    <CaretDoubleLeft size={15} />
                  </NavBtn>
                  <NavBtn onClick={() => t.setCurrentPage((p) => Math.max(1, p - 1))} disabled={t.safePage === 1} title="Anterior">
                    <CaretLeft size={15} />
                  </NavBtn>

                  {buildPageRange(t.safePage, t.totalPages).map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} className="px-1 text-gray-500 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => t.setCurrentPage(p as number)}
                        className={cn(
                          'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                          p === t.safePage ? 'bg-accent-600 text-white' : 'text-gray-600 hover:bg-gray-100',
                        )}
                      >
                        {p}
                      </button>
                    ),
                  )}

                  <NavBtn onClick={() => t.setCurrentPage((p) => Math.min(t.totalPages, p + 1))} disabled={t.safePage === t.totalPages} title="Siguiente">
                    <CaretRight size={15} />
                  </NavBtn>
                  <NavBtn onClick={() => t.setCurrentPage(t.totalPages)} disabled={t.safePage === t.totalPages} title="Última">
                    <CaretDoubleRight size={15} />
                  </NavBtn>
                </div>
              </div>
            )}
          />
        )}
      </div>
    </AppShell>
  );
}

function NavBtn({ onClick, disabled, title, children }: {
  onClick: () => void; disabled: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
      {children}
    </button>
  );
}

function buildPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
