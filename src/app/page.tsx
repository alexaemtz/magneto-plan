'use client';

import { useEffect, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import AppShell from '@/components/AppShell';
import GanttChart from '@/components/GanttChart';
import AppointmentForm from '@/components/AppointmentForm';
import AppointmentDetailDialog from '@/components/AppointmentDetailDialog';
import RampBlockForm from '@/components/RampBlockForm';
import RampBlockDetailDialog from '@/components/RampBlockDetailDialog';
import RampBlocksSummary from '@/components/RampBlocksSummary';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Appointment, Ramp, RampBlock } from '@/types';
import { deleteAppointment, updateAppointment } from '@/lib/firestore/appointments';
import { subscribeToRampBlocks, deleteRampBlock } from '@/lib/firestore/rampBlocks';
import { todayISO, formatDate, isoToDisplay, timeToMinutes, minutesToTime } from '@/lib/utils';
import { useDateAppointments } from '@/hooks/useDateAppointments';
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Calendar, CalendarDays, CircleCheck, Loader2, Wrench, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearch } from '@/context/SearchContext';
import { PageHeader, StatCard, Card, EmptyState, Skeleton } from '@/components/ui/primitives';

export default function DashboardPage() {
  const [date, setDate]     = useState(todayISO());
  const dateInputRef        = useRef<HTMLInputElement>(null);
  const perms               = usePermissions('dashboard');
  const { appointments, loading } = useDateAppointments(date);

  function shiftDay(n: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    setDate(d.toISOString().split('T')[0]);
  }
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [selectedRamp, setSelectedRamp] = useState<Ramp | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('08:00');
  const [rampBlocks, setRampBlocks] = useState<RampBlock[]>([]);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockRamp, setBlockRamp] = useState<Ramp | null>(null);
  const [blockTime, setBlockTime] = useState('08:00');
  const [detailBlock, setDetailBlock] = useState<RampBlock | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Appointment | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<RampBlock | null>(null);
  const { query } = useSearch();

  const searchedAppts = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return appointments;
    if (q === 'campaña' || q === 'campana') return appointments.filter((a) => a.campaña === true);
    return appointments.filter((a) =>
      [a.clientName, a.advisor, a.tecnico, a.carModel, a.serialNumber, a.workOrder, a.startTime]
        .some((v) => v?.toLowerCase().includes(q))
    );
  })();

  useEffect(() => {
    const unsub = subscribeToRampBlocks(setRampBlocks);
    return unsub;
  }, []);

  function handleSlotClick(ramp: Ramp | null, time: string) {
    setEditAppt(undefined);
    setSelectedRamp(ramp);
    setSelectedTime(time);
    setShowForm(true);
  }

  function handleSelectAppt(appt: Appointment) {
    setDetailAppt(appt);
  }

  function handleEditFromDetail(appt: Appointment) {
    setEditAppt(appt);
    setSelectedRamp(appt.ramp);
    setSelectedTime(appt.startTime);
    setShowForm(true);
  }

  function handleDelete(appt: Appointment) {
    setConfirmDelete(appt);
  }

  async function handleDeleteConfirmed(appt: Appointment) {
    setConfirmDelete(null);
    await deleteAppointment(appt.id!, date);
    toast.success('Cita eliminada');
  }

  function handleDisableRamp(ramp: Ramp | null, time: string) {
    if (ramp == null) return;
    setBlockRamp(ramp);
    setBlockTime(time);
    setShowBlockForm(true);
  }

  async function handleReactivateConfirmed(block: RampBlock) {
    setConfirmReactivate(null);
    await deleteRampBlock(block.id!);
    toast.success('Rampa reactivada');
  }

  async function handleMove(
    appt: Appointment,
    targetRamp: Ramp | null,
    targetType: string,
    targetTime: string,
  ) {
    try {
      if (targetType === 'wash') {
        await updateAppointment(appt.id!, { status: 'LAVADO', lavadoStartTime: targetTime }, date);
      } else if (targetType === 'no_show') {
        await updateAppointment(appt.id!, { status: 'NO_SHOW', ramp: null }, date);
      } else {
        const duration   = Math.max(timeToMinutes(appt.endTime) - timeToMinutes(appt.startTime), 30);
        const newEnd     = minutesToTime(timeToMinutes(targetTime) + duration);
        const wasSpecial = appt.status === 'LAVADO' || appt.status === 'NO_SHOW';
        await updateAppointment(appt.id!, {
          ramp: targetRamp,
          startTime: targetTime,
          endTime: newEnd,
          ...(wasSpecial ? { status: 'PROGRAMADO' } : {}),
        }, date);
      }
      toast.success('Cita movida');
    } catch {
      toast.error('Error al mover la cita');
    }
  }

  return (
    <AppShell>
      <div className="px-6 py-7 space-y-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Dashboard"
          description={`${formatDate(date)} · Servicios programados y estado de rampas`}
        >
          <RampBlocksSummary blocks={rampBlocks} onReactivate={(b) => setConfirmReactivate(b)} />

          {/* Date navigator */}
          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-[0_1px_2px_rgba(17,24,39,0.04)] px-1.5 py-1.5">
            <button
              onClick={() => shiftDay(-1)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              aria-label="Día anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div
              className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => dateInputRef.current?.showPicker()}
            >
              <Calendar size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700 select-none tabular">
                {isoToDisplay(date)}
              </span>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="sr-only"
              />
            </div>
            <button
              onClick={() => shiftDay(1)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              aria-label="Día siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {perms.create && (
            <button
              onClick={() => { setEditAppt(undefined); setSelectedRamp(null); setSelectedTime('08:00'); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus size={16} />
              Nueva cita
            </button>
          )}
        </PageHeader>

        {/* Stats */}
        {(() => {
          const totalHours = appointments.reduce((sum, a) => sum + (a.workHours ?? 0), 0);
          const hoursDisplay = totalHours.toFixed(1);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
              <StatCard label="Total del día" value={appointments.length} tone="accent" icon={<CalendarDays size={17} />} />
              <StatCard label="Entregados" value={appointments.filter(a => a.status === 'ENTREGADO').length} tone="success" icon={<CircleCheck size={17} />} />
              <StatCard label="En proceso" value={appointments.filter(a => a.status === 'EN_PROCESO').length} tone="warning" icon={<Loader2 size={17} />} />
              <StatCard label="No show" value={appointments.filter(a => a.status === 'NO_SHOW').length} tone="danger" icon={<Inbox size={17} />} />
              <StatCard label="Horas del día" value={hoursDisplay} sub="Tiempo en rampa" tone="violet" icon={<Wrench size={17} />} />
            </div>
          );
        })()}

        {/* Gantt */}
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold text-gray-800 tracking-tight">
              Magneto Plan · Hoy
            </h2>
            {query.trim() && (
              <span className="text-xs font-medium text-gray-400">
                {searchedAppts.length} de {appointments.length} citas
              </span>
            )}
          </div>
          {loading ? (
            <Skeleton className="h-[440px] w-full rounded-2xl" />
          ) : (
            <GanttChart
              appointments={searchedAppts}
              date={date}
              rampBlocks={rampBlocks}
              onSlotClick={perms.create ? handleSlotClick : undefined}
              onSelect={handleSelectAppt}
              onDelete={perms.delete ? handleDelete : undefined}
              onMove={perms.update ? handleMove : undefined}
              onDisableRamp={perms.create ? handleDisableRamp : undefined}
              onSelectRampBlock={setDetailBlock}
            />
          )}
        </div>

        {/* Citas list */}
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold text-gray-800 tracking-tight">
              Citas · {isoToDisplay(date)}
            </h2>
            <span className="text-xs font-medium text-gray-400 tabular">
              {loading ? '…' : `${searchedAppts.length}${searchedAppts.length !== appointments.length ? ` / ${appointments.length}` : ''}`}
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full rounded-2xl" />
          ) : (
            <>
              {searchedAppts.length === 0 ? (
                query.trim()
                  ? <EmptyState title="Sin resultados para la búsqueda" description="Prueba con otro término o limpia la búsqueda." />
                  : <EmptyState title="No hay citas para hoy" description="Usa «Nueva cita» para agendar el primer servicio." />
              ) : (
                <Card className="overflow-hidden">
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {searchedAppts.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors">
                        <div className="text-xs font-medium text-gray-500 tabular w-10 shrink-0">{a.startTime}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{a.carModel} · {a.clientName}</p>
                          <p className="text-xs text-gray-500 truncate">{a.serialNumber} | Asesor: {a.advisor}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {perms.update && (
                            <button onClick={() => handleEditFromDetail(a)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                              <Pencil size={14} />
                            </button>
                          )}
                          {perms.delete && (
                            <button onClick={() => handleDelete(a)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {detailAppt && (
        <AppointmentDetailDialog
          appt={detailAppt}
          onClose={() => setDetailAppt(null)}
          onEdit={handleEditFromDetail}
          onDelete={handleDelete}
        />
      )}

      {showForm && (
        <AppointmentForm
          date={date}
          initial={editAppt}
          ramp={selectedRamp ?? undefined}
          startTime={selectedTime}
          existingAppointments={appointments}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      {showBlockForm && blockRamp != null && (
        <RampBlockForm
          ramp={blockRamp}
          date={date}
          startTime={blockTime}
          onClose={() => setShowBlockForm(false)}
          onSaved={() => { setShowBlockForm(false); toast.success('Rampa inhabilitada'); }}
        />
      )}

      {detailBlock && (
        <RampBlockDetailDialog
          block={detailBlock}
          onClose={() => setDetailBlock(null)}
          onReactivate={(b) => setConfirmReactivate(b)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar cita?"
          message={`${confirmDelete.clientName} · ${confirmDelete.carModel}`}
          detail={`${isoToDisplay(confirmDelete.date)} · ${confirmDelete.startTime}`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeleteConfirmed(confirmDelete)}
        />
      )}

      {confirmReactivate && (
        <ConfirmDialog
          title="Reactivar rampa"
          message={`¿Reactivar Rampa ${confirmReactivate.ramp}?`}
          confirmLabel="Reactivar"
          onCancel={() => setConfirmReactivate(null)}
          onConfirm={() => handleReactivateConfirmed(confirmReactivate)}
        />
      )}
    </AppShell>
  );
}
