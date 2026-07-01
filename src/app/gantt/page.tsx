'use client';

import { useEffect, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import AppShell from '@/components/AppShell';
import GanttChart from '@/components/GanttChart';
import AppointmentForm from '@/components/AppointmentForm';
import AppointmentDetailDialog from '@/components/AppointmentDetailDialog';
import AppointmentTable from '@/components/AppointmentTable';
import { Appointment, Ramp } from '@/types';
import { subscribeToAppointmentsByDate, deleteAppointment } from '@/lib/firestore/appointments';
import { todayISO, formatDate, isoToDisplay } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, Table2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type Tab = 'gantt' | 'tabla';

export default function GanttPage() {
  const [date, setDate]                 = useState(todayISO());
  const dateInputRef                    = useRef<HTMLInputElement>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editAppt, setEditAppt]         = useState<Appointment | undefined>();
  const [detailAppt, setDetailAppt]     = useState<Appointment | null>(null);
  const [selectedRamp, setSelectedRamp] = useState<Ramp | null>(null);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [activeTab, setActiveTab]       = useState<Tab>('gantt');
  const perms                           = usePermissions('gantt');

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAppointmentsByDate(date, (appts) => {
      setAppointments(appts);
      setLoading(false);
    });
    return unsub;
  }, [date]);

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

  async function handleDelete(appt: Appointment) {
    if (!confirm(`¿Eliminar cita de ${appt.clientName}?`)) return;
    await deleteAppointment(appt.id!);
    toast.success('Cita eliminada');
  }

  return (
    <AppShell>
      <div className="px-6 py-6 space-y-4 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Magneto Plan</h1>
            <p className="text-sm text-gray-500 mt-0.5">Citas del día</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
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

        {/* ── Tabs + subtitle ── */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 font-medium">
            {formatDate(date)} — {appointments.length} cita{appointments.length !== 1 ? 's' : ''}
          </p>

          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => setActiveTab('gantt')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-colors',
                activeTab === 'gantt' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              <LayoutGrid size={13} />
              Gantt
            </button>
            <button
              onClick={() => setActiveTab('tabla')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition-colors border-l border-gray-200',
                activeTab === 'tabla' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              <Table2 size={13} />
              Tabla
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {activeTab === 'gantt' ? (
          loading ? (
            <div className="h-64 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <GanttChart
              appointments={appointments}
              date={date}
              onSlotClick={perms.create ? handleSlotClick : undefined}
              onSelect={handleSelectAppt}
              onDelete={perms.delete ? handleDelete : undefined}
            />
          )
        ) : (
          loading ? (
            <div className="h-64 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AppointmentTable
              appointments={appointments}
              date={date}
              onRefresh={() => {}}
            />
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
    </AppShell>
  );
}
