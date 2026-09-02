'use client';

import { useEffect, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import AppShell from '@/components/AppShell';
import GanttChart from '@/components/GanttChart';
import AppointmentForm from '@/components/AppointmentForm';
import AppointmentDetailDialog from '@/components/AppointmentDetailDialog';
import AppointmentTable from '@/components/AppointmentTable';
import TecnicoHoursTab from '@/components/TecnicoHoursTab';
import RampBlockForm from '@/components/RampBlockForm';
import RampBlockDetailDialog from '@/components/RampBlockDetailDialog';
import RampBlocksSummary from '@/components/RampBlocksSummary';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Appointment, Ramp, RampBlock } from '@/types';
import { deleteAppointment, updateAppointment } from '@/lib/firestore/appointments';
import { subscribeToRampBlocks, deleteRampBlock } from '@/lib/firestore/rampBlocks';
import { todayISO, formatDate, isoToDisplay, timeToMinutes, minutesToTime } from '@/lib/utils';
import { useDateAppointments } from '@/hooks/useDateAppointments';
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, Table2, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useSearch } from '@/context/SearchContext';
import { PageHeader, Skeleton } from '@/components/ui/primitives';

type Tab = 'gantt' | 'tabla' | 'horas';

export default function GanttPage() {
  const [date, setDate]                 = useState(todayISO());
  const dateInputRef                    = useRef<HTMLInputElement>(null);
  const { appointments, loading } = useDateAppointments(date);
  const [showForm, setShowForm]         = useState(false);
  const [editAppt, setEditAppt]         = useState<Appointment | undefined>();
  const [detailAppt, setDetailAppt]     = useState<Appointment | null>(null);
  const [selectedRamp, setSelectedRamp] = useState<Ramp | null>(null);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [activeTab, setActiveTab]       = useState<Tab>('gantt');
  const [rampBlocks, setRampBlocks]     = useState<RampBlock[]>([]);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockRamp, setBlockRamp]       = useState<Ramp | null>(null);
  const [blockTime, setBlockTime]       = useState('08:00');
  const [detailBlock, setDetailBlock]   = useState<RampBlock | null>(null);
  const [confirmDelete, setConfirmDelete]     = useState<Appointment | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<RampBlock | null>(null);
  const perms                           = usePermissions('gantt');
  const { query }                       = useSearch();

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

  function shiftDay(n: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    setDate(d.toISOString().split('T')[0]);
  }

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

  function handleSaved() {
    setShowForm(false);
    toast.success(editAppt ? 'Cita actualizada' : 'Cita creada');
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
        const duration = Math.max(timeToMinutes(appt.endTime) - timeToMinutes(appt.startTime), 30);
        const newEnd   = minutesToTime(timeToMinutes(targetTime) + duration);
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
      <div className="px-6 py-7 space-y-4 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <PageHeader
          title="Magneto Plan"
          description="Citas del día"
        >
          <RampBlocksSummary blocks={rampBlocks} onReactivate={(b) => setConfirmReactivate(b)} />

          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-sm px-1.5 py-1.5">
            <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors" aria-label="Día anterior">
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
            <button onClick={() => shiftDay(1)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors" aria-label="Día siguiente">
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

        {/* ── Tabs + subtitle ── */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 font-medium tabular">
            {formatDate(date)} · {searchedAppts.length}{searchedAppts.length !== appointments.length ? `/${appointments.length}` : ''} cita{searchedAppts.length !== 1 ? 's' : ''}
          </p>

          <div className="flex rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04)] p-1">
            <button
              onClick={() => setActiveTab('gantt')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                activeTab === 'gantt' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )}
            >
              <LayoutGrid size={13} />
              Gantt
            </button>
            <button
              onClick={() => setActiveTab('tabla')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                activeTab === 'tabla' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )}
            >
              <Table2 size={13} />
              Tabla
            </button>
            <button
              onClick={() => setActiveTab('horas')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                activeTab === 'horas' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )}
            >
              <Clock size={13} />
              Horas por Técnico
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {activeTab === 'gantt' ? (
          loading ? (
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
          )
        ) : activeTab === 'tabla' ? (
          loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AppointmentTable
              appointments={searchedAppts}
              onRefresh={() => {}}
            />
          )
        ) : (
          loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <TecnicoHoursTab appointments={searchedAppts} />
          )
        )}
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
          onSaved={handleSaved}
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
