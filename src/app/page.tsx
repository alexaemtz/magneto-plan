'use client';

import { useEffect, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import AppShell from '@/components/AppShell';
import GanttChart from '@/components/GanttChart';
import AppointmentForm from '@/components/AppointmentForm';
import AppointmentDetailDialog from '@/components/AppointmentDetailDialog';
import { Appointment, Ramp } from '@/types';
import { subscribeToAppointmentsByDate, deleteAppointment, updateAppointment } from '@/lib/firestore/appointments';
import { todayISO, formatDate, isoToDisplay, timeToMinutes, minutesToTime } from '@/lib/utils';
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearch } from '@/context/SearchContext';

export default function DashboardPage() {
  const [date, setDate]     = useState(todayISO());
  const dateInputRef        = useRef<HTMLInputElement>(null);
  const perms               = usePermissions('dashboard');

  function shiftDay(n: number) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    setDate(d.toISOString().split('T')[0]);
  }
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [selectedRamp, setSelectedRamp] = useState<Ramp | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('08:00');
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
    setLoading(true);
    const unsub = subscribeToAppointmentsByDate(date, (appts) => {
      setAppointments(appts);
      setLoading(false);
    });
    return unsub;
  }, [date]);

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

  async function handleDelete(appt: Appointment) {
    if (!confirm(`¿Eliminar cita de ${appt.clientName}?`)) return;
    await deleteAppointment(appt.id!, date);
    toast.success('Cita eliminada');
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
      <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">{formatDate(date)}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date navigator */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-1">
              <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <ChevronLeft size={18} className="text-gray-600" />
              </button>
              <div
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => dateInputRef.current?.showPicker()}
              >
                <Calendar size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700 select-none">
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
              <button onClick={() => shiftDay(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <ChevronRight size={18} className="text-gray-600" />
              </button>
            </div>

            {perms.create && (
              <button
                onClick={() => { setEditAppt(undefined); setSelectedRamp(null); setSelectedTime('08:00'); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
              >
                <Plus size={16} />
                Nueva cita
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {(() => {
          const totalHours = appointments.reduce((sum, a) => sum + (a.workHours ?? 0), 0);
          const hoursDisplay = totalHours.toFixed(1);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: 'Total del día',  value: appointments.length,                                        unit: '',  color: 'text-blue-600'   },
                { label: 'Entregados',     value: appointments.filter(a => a.status === 'ENTREGADO').length,  unit: '',  color: 'text-green-600'  },
                { label: 'En proceso',     value: appointments.filter(a => a.status === 'EN_PROCESO').length,  unit: '',  color: 'text-amber-600'  },
                { label: 'No show',        value: appointments.filter(a => a.status === 'NO_SHOW').length,     unit: '',  color: 'text-red-600'    },
                { label: 'Horas del día',  value: hoursDisplay,                                               unit: ' h', color: 'text-violet-600' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}{s.unit}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Gantt */}
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Magneto Plan — Hoy
            {query.trim() && <span className="ml-2 text-sm font-normal text-gray-400">({searchedAppts.length} de {appointments.length})</span>}
          </h2>
          {loading ? (
            <div className="h-48 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <GanttChart
              appointments={searchedAppts}
              date={date}
              onSlotClick={perms.create ? handleSlotClick : undefined}
              onSelect={handleSelectAppt}
              onDelete={perms.delete ? handleDelete : undefined}
              onMove={perms.update ? handleMove : undefined}
            />
          )}
        </div>

        {/* Citas list */}
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Citas — {isoToDisplay(date)} ({searchedAppts.length}{searchedAppts.length !== appointments.length ? `/${appointments.length}` : ''})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {searchedAppts.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                {query.trim() ? 'Sin resultados para la búsqueda' : 'No hay citas para hoy'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {searchedAppts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                    <div className="text-xs font-mono text-gray-500 w-10 shrink-0">{a.startTime}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{a.carModel} — {a.clientName}</p>
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
            )}
          </div>
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
    </AppShell>
  );
}
