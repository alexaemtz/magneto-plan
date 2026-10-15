'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  todayISO,
  formatDate,
  isoToDisplay,
  timeToMinutes,
  minutesToTime,
  rampBlockRangeForDate,
  SERVICE_LABELS,
} from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useDateAppointments } from '@/hooks/useDateAppointments';
import {
  CaretLeft,
  CaretRight,
  Calendar as CalendarIcon,
  Plus,
  Eye,
  PencilSimple,
  Trash,
  Prohibit,
  Tray,
  Hourglass,
  ArrowsClockwise,
  WarningCircle,
  CircleNotch,
  CheckCircle,
  Wrench,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { useSearch } from '@/context/SearchContext';
import { PageHeader, StatCard, Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  APPOINTMENT_STATUS_LABELS as STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS as STATUS_COLORS,
} from '@/lib/status';

const BAYS: { ramp: number; label: string }[] = [
  { ramp: 1, label: 'Rampa 1' },
  { ramp: 2, label: 'Rampa 2' },
  { ramp: 3, label: 'Rampa 3' },
  { ramp: 4, label: 'Rampa 4' },
  { ramp: 5, label: 'Rampa 5' },
  { ramp: 6, label: 'Alineador' },
];

const CAPACITY_H = 14; // 07:00–21:00

function durationHours(a: Appointment): number {
  return Math.max(0, timeToMinutes(a.endTime) - timeToMinutes(a.startTime)) / 60;
}

interface AttentionItem {
  id: string;
  kind: string;
  icon: React.ReactNode;
  appt?: Appointment;
  block?: RampBlock;
  note: string;
}

export default function DashboardPage() {
  const [date, setDate] = useState(todayISO());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { appointments, loading } = useDateAppointments(date);
  const [rampBlocks, setRampBlocks] = useState<RampBlock[]>([]);
  const { query } = useSearch();
  const perms = usePermissions('dashboard');

  // Gantt / appointment interaction state
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [selectedRamp, setSelectedRamp] = useState<Ramp | null>(null);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockRamp, setBlockRamp] = useState<Ramp | null>(null);
  const [blockTime, setBlockTime] = useState('08:00');
  const [detailBlock, setDetailBlock] = useState<RampBlock | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Appointment | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<RampBlock | null>(null);

  useEffect(() => {
    const unsub = subscribeToRampBlocks(setRampBlocks);
    return unsub;
  }, []);

  function shiftDay(n: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    setDate(d.toISOString().split('T')[0]);
  }

  const q = query.trim().toLowerCase();
  const searchedAppts = (() => {
    if (!q) return appointments;
    if (q === 'campaña' || q === 'campana') return appointments.filter((a) => a.campaña === true);
    return appointments.filter((a) =>
      [a.clientName, a.advisor, a.tecnico, a.carModel, a.serialNumber, a.workOrder, a.startTime]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  })();

  // ── Exception queue ────────────────────────────────────────────────────────
  const attention = useMemo<AttentionItem[]>(() => {
    const matches = (a: Appointment) =>
      !q ||
      [a.clientName, a.advisor, a.tecnico, a.carModel, a.serialNumber, a.workOrder]
        .some((v) => v?.toLowerCase().includes(q));
    const items: AttentionItem[] = [];

    for (const b of rampBlocks) {
      const range = rampBlockRangeForDate(b, date);
      if (!range) continue;
      items.push({
        id: `block-${b.id}`,
        kind: 'Rampa inhabilitada',
        icon: <Prohibit size={15} />,
        block: b,
        note: `${b.ramp === 6 ? 'Alineador' : `Rampa ${b.ramp}`}, ${range.startTime}–${range.endTime}`,
      });
    }

    for (const a of appointments.filter(matches)) {
      if (a.status === 'NO_SHOW') {
        items.push({ id: `ns-${a.id}`, kind: 'No show', icon: <Tray size={15} />, appt: a, note: a.startTime });
      } else if (a.status === 'ESPERANDO_REFACCION') {
        items.push({ id: `wr-${a.id}`, kind: 'Esperando refacción', icon: <Hourglass size={15} />, appt: a, note: a.carModel });
      } else if (a.status === 'CARRY_OVER') {
        items.push({ id: `co-${a.id}`, kind: 'Carry over', icon: <ArrowsClockwise size={15} />, appt: a, note: a.carModel });
      } else if (!a.ramp && a.status !== 'LAVADO' && a.status !== 'ENTREGADO') {
        items.push({ id: `un-${a.id}`, kind: 'Sin asignar', icon: <WarningCircle size={15} />, appt: a, note: a.carModel });
      }
    }

    return items;
  }, [appointments, rampBlocks, date, q]);

  // ── Load per bay ───────────────────────────────────────────────────────────
  const bayLoad = useMemo(() => {
    return BAYS.map((bay) => {
      const booked = appointments
        .filter((a) => a.ramp === bay.ramp && a.status !== 'NO_SHOW' && a.status !== 'LAVADO')
        .reduce((s, a) => s + durationHours(a), 0);
      const count = appointments.filter((a) => a.ramp === bay.ramp).length;
      return { ...bay, booked, count, pct: Math.min(100, Math.round((booked / CAPACITY_H) * 100)) };
    });
  }, [appointments]);

  const delivered = appointments.filter((a) => a.status === 'ENTREGADO').length;
  const inProcess = appointments.filter((a) => a.status === 'EN_PROCESO').length;
  const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length;
  const totalHours = appointments.reduce((s, a) => s + (a.workHours ?? 0), 0);

  // ── Gantt handlers ─────────────────────────────────────────────────────────
  function handleSlotClick(ramp: Ramp | null, time: string) {
    setEditAppt(undefined);
    setSelectedRamp(ramp);
    setSelectedTime(time);
    setShowForm(true);
  }

  function handleEdit(appt: Appointment) {
    setEditAppt(appt);
    setSelectedRamp(appt.ramp);
    setSelectedTime(appt.startTime);
    setShowForm(true);
  }

  async function handleDeleteConfirmed(appt: Appointment) {
    setConfirmDelete(null);
    try {
      await deleteAppointment(appt.id!, date);
      toast.success('Cita eliminada');
    } catch {
      toast.error('Error al eliminar la cita');
    }
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
        <PageHeader title="Panel del día" description={`${formatDate(date)}, tablero, excepciones y carga de rampas`}>
          <RampBlocksSummary blocks={rampBlocks} onReactivate={(b) => setConfirmReactivate(b)} />

          <div className="flex items-center gap-1 bg-surface rounded-xl border border-line shadow-[var(--shadow-card)] px-1.5 py-1.5">
            <button
              onClick={() => shiftDay(-1)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              aria-label="Día anterior"
            >
              <CaretLeft size={18} />
            </button>
            <div
              className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => dateInputRef.current?.showPicker()}
            >
              <CalendarIcon size={14} className="text-gray-500" />
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
              <CaretRight size={18} />
            </button>
          </div>

          {perms.create && (
            <button
              onClick={() => { setEditAppt(undefined); setSelectedRamp(null); setSelectedTime('08:00'); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 text-white text-sm font-semibold hover:bg-accent-700 active:scale-[0.98] transition-all shadow-lg shadow-accent-600/20"
            >
              <Plus size={16} />
              Nueva cita
            </button>
          )}
        </PageHeader>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard label="Citas del día" value={appointments.length} tone="accent" icon={<CalendarIcon size={17} />} />
          <StatCard label="En proceso" value={inProcess} tone="warning" icon={<CircleNotch size={17} />} />
          <StatCard label="Entregados" value={delivered} tone="success" icon={<CheckCircle size={17} />} />
          <StatCard label="No show" value={noShow} tone="danger" icon={<Tray size={17} />} />
          <StatCard label="Horas en rampa" value={totalHours.toFixed(1)} sub="h" tone="accent" icon={<Wrench size={17} />} />
        </div>

        {/* Ramp board */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 tracking-tight mb-3">
            Magneto Plan · Tablero
          </h2>
          {loading ? (
            <Skeleton className="h-[440px] w-full rounded-2xl" />
          ) : (
            <GanttChart
              appointments={searchedAppts}
              date={date}
              rampBlocks={rampBlocks}
              onSlotClick={perms.create ? handleSlotClick : undefined}
              onSelect={setDetailAppt}
              onDelete={perms.delete ? setConfirmDelete : undefined}
              onMove={perms.update ? handleMove : undefined}
              onDisableRamp={perms.create ? handleDisableRamp : undefined}
              onSelectRampBlock={setDetailBlock}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exception queue */}
          <div className="lg:col-span-2">
            <h2 className="text-base font-semibold text-gray-800 tracking-tight mb-3">
              Requieren atención
            </h2>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : attention.length === 0 ? (
              <EmptyState
                title="Nada pendiente"
                description="No hay rampas inhabilitadas, no shows ni casos en espera para este día."
              />
            ) : (
              <Card className="overflow-hidden divide-y divide-line">
                {attention.map((item) => (
                  <div
                    key={item.id}
                    onDoubleClick={() => {
                      if (item.appt && perms.update) handleEdit(item.appt);
                      else if (item.block) setDetailBlock(item.block);
                    }}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/60 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-surface-muted text-gray-500 flex items-center justify-center shrink-0">
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.kind}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.appt
                          ? `${item.appt.carModel}, ${item.appt.clientName}, ${SERVICE_LABELS[item.appt.serviceType]}`
                          : item.note}
                      </p>
                    </div>
                    {item.appt && (
                      <StatusPill size="sm" color={STATUS_COLORS[item.appt.status]}>
                        {STATUS_LABELS[item.appt.status]}
                      </StatusPill>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => {
                          if (item.appt) setDetailAppt(item.appt);
                          else if (item.block) setDetailBlock(item.block);
                        }}
                        title="Ver detalle"
                        aria-label="Ver detalle"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-accent-50 hover:text-accent-600 transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => item.appt && perms.update && handleEdit(item.appt)}
                        disabled={!item.appt || !perms.update}
                        title="Editar"
                        aria-label="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-accent-50 hover:text-accent-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <PencilSimple size={15} />
                      </button>
                      <button
                        onClick={() => item.appt && perms.delete && setConfirmDelete(item.appt)}
                        disabled={!item.appt || !perms.delete}
                        title="Eliminar"
                        aria-label="Eliminar"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {/* Bay load */}
          <div>
            <h2 className="text-base font-semibold text-gray-800 tracking-tight mb-3">
              Carga por rampa
            </h2>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : (
              <Card className="px-5 py-4 space-y-4">
                {bayLoad.map((bay) => (
                  <div key={bay.ramp}>
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{bay.label}</span>
                      <span className="text-xs text-gray-500 tabular">
                        {bay.booked.toFixed(1)} h, {bay.count} cita{bay.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-500 origin-left transition-transform"
                        style={{ width: '100%', transform: `scaleX(${bay.pct / 100})` }}
                      />
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>

      {detailAppt && (
        <AppointmentDetailDialog
          appt={detailAppt}
          onClose={() => setDetailAppt(null)}
          onEdit={handleEdit}
          onDelete={setConfirmDelete}
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
          onSaved={() => { setShowForm(false); toast.success(editAppt ? 'Cita actualizada' : 'Cita creada'); }}
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
          message={`${confirmDelete.clientName}, ${confirmDelete.carModel}`}
          detail={`${isoToDisplay(confirmDelete.date)}, ${confirmDelete.startTime}`}
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
