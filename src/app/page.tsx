'use client';

import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import AppShell from '@/components/AppShell';
import GanttChart from '@/components/GanttChart';
import DailyIndicatorTable from '@/components/DailyIndicator';
import AppointmentForm from '@/components/AppointmentForm';
import AppointmentDetailDialog from '@/components/AppointmentDetailDialog';
import { Appointment, DailyIndicator, Ramp } from '@/types';
import { subscribeToAppointmentsByDate, deleteAppointment, updateAppointment } from '@/lib/firestore/appointments';
import { getDailyIndicator } from '@/lib/firestore/indicators';
import { todayISO, formatDate, timeToMinutes, minutesToTime } from '@/lib/utils';
import { Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

const makeEmptyIndicator = (date: string): DailyIndicator => ({
  date,
  citadosServicio: { hoy: 0, realizado: 0, acumulado: 0 },
  citadosServicioPlusOne: { hoy: 0, realizado: 0, acumulado: 0 },
  citadosReparacion: { hoy: 0, realizado: 0, acumulado: 0 },
  citadosRevision: { hoy: 0, realizado: 0, acumulado: 0 },
  sinCita: { hoy: 0, realizado: 0, acumulado: 0 },
  totalDia: 0,
  ingresosTotal: 0,
});

export default function DashboardPage() {
  const date = todayISO();
  const perms = usePermissions('dashboard');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [indicator, setIndicator] = useState<DailyIndicator>(makeEmptyIndicator(date));
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [selectedRamp, setSelectedRamp] = useState<Ramp | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('08:00');

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAppointmentsByDate(date, (appts) => {
      setAppointments(appts);
      setLoading(false);
    });
    getDailyIndicator(date)
      .then((ind) => setIndicator(ind ?? makeEmptyIndicator(date)))
      .catch((err) => {
        console.error('Error cargando indicador:', err);
        toast.error('Error al cargar los datos. Verifica la configuración de Firebase.');
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">{formatDate(date)}</p>
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

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total del día', value: appointments.length, color: 'text-blue-600' },
            { label: 'Completados', value: appointments.filter(a => a.status === 'COMPLETADO').length, color: 'text-green-600' },
            { label: 'En proceso', value: appointments.filter(a => a.status === 'EN_PROCESO').length, color: 'text-amber-600' },
            { label: 'No show', value: appointments.filter(a => a.status === 'NO_SHOW').length, color: 'text-red-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Gantt */}
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Magneto Plan — Hoy</h2>
          {loading ? (
            <div className="h-48 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <GanttChart
              appointments={appointments}
              date={date}
              onSlotClick={perms.create ? handleSlotClick : undefined}
              onSelect={handleSelectAppt}
              onDelete={perms.delete ? handleDelete : undefined}
              onMove={perms.update ? handleMove : undefined}
            />
          )}
        </div>

        {/* Indicator + list */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3">Indicador de hoy</h2>
            <DailyIndicatorTable indicator={indicator} onSave={setIndicator} />
          </div>

          <div>
            <h2 className="text-base font-semibold text-gray-700 mb-3">Citas programadas ({appointments.length})</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {appointments.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No hay citas para hoy</div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {appointments.map((a) => (
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
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}
    </AppShell>
  );
}
