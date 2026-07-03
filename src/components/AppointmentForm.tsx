'use client';

import { useEffect, useState } from 'react';
import { Appointment, ServiceType, Ramp, AppointmentStatus } from '@/types';
import { SERVICE_LABELS, generateTimeSlots, formatRamp, timeToMinutes, minutesToTime } from '@/lib/utils';
import { createAppointment, updateAppointment } from '@/lib/firestore/appointments';
import { createPendingCase } from '@/lib/firestore/pendingCases';
import { getAdvisors, getCarModels } from '@/lib/firestore/catalog';
import { Advisor, CarModel } from '@/types';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface Props {
  date: string;
  initial?: Partial<Appointment>;
  ramp?: Ramp | null;
  startTime?: string;
  existingAppointments?: Appointment[];
  onClose: () => void;
  onSaved: () => void;
}

const RAMPS: (Ramp | 'none')[] = [1, 2, 3, 4, 5, 6, 'none'];
const SERVICE_TYPES = Object.keys(SERVICE_LABELS) as ServiceType[];
const TIME_SLOTS = generateTimeSlots('07:00', '21:00', 30);
const MAINTENANCE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const DEFAULT: Partial<Appointment> = {
  serviceType: 'SERVICIO',
  appByd: false,
  invoice: false,
  workHours: 1,
  status: 'PROGRAMADO',
  maintenanceLevel: 1,
};

function sameRamp(a: Ramp | null | undefined, b: Ramp | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
}

function findConflict(existing: Appointment[], form: Partial<Appointment>, editingId?: string): Appointment | null {
  if (!form.ramp || !form.startTime || !form.endTime || !form.date) return null;
  for (const appt of existing) {
    if (appt.id === editingId) continue;
    if (appt.status === 'NO_SHOW') continue;
    if (appt.date !== form.date || !sameRamp(appt.ramp, form.ramp)) continue;
    if (form.startTime < appt.endTime && form.endTime > appt.startTime) return appt;
  }
  return null;
}

// Returns the first gap on the same ramp/date with enough room for the service duration.
function findNextSlot(
  existing: Appointment[],
  form: Partial<Appointment>,
  editingId?: string,
): { startTime: string; endTime: string } | null {
  if (!form.ramp || !form.startTime || !form.endTime || !form.date) return null;
  const duration = timeToMinutes(form.endTime) - timeToMinutes(form.startTime);
  if (duration <= 0) return null;

  const rampAppts = existing
    .filter((a) => a.id !== editingId && a.date === form.date && a.status !== 'NO_SHOW' && sameRamp(a.ramp, form.ramp))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  let candidate = timeToMinutes(form.startTime);
  const dayEnd  = timeToMinutes('21:00');

  while (candidate + duration <= dayEnd) {
    const candidateEnd = candidate + duration;
    const conflict = rampAppts.find((a) => {
      const aStart = timeToMinutes(a.startTime);
      const aEnd   = timeToMinutes(a.endTime);
      return candidate < aEnd && candidateEnd > aStart;
    });
    if (!conflict) return { startTime: minutesToTime(candidate), endTime: minutesToTime(candidateEnd) };
    candidate = timeToMinutes(conflict.endTime);
  }
  return null;
}

export default function AppointmentForm({ date, initial, ramp, startTime, existingAppointments = [], onClose, onSaved }: Props) {
  const [form, setForm] = useState<Partial<Appointment>>({
    ...DEFAULT,
    date,
    ramp: ramp ?? null,
    startTime: startTime ?? '08:00',
    endTime: '09:00',
    ...initial,
  });
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAdvisors(true), getCarModels(true)])
      .then(([a, c]) => { setAdvisors(a); setCarModels(c); })
      .catch((err) => { console.error('Error cargando catálogos:', err); })
      .finally(() => setCatalogsLoading(false));
  }, []);

  useEffect(() => {
    const start = form.startTime;
    const end   = form.endTime;
    if (!start || !end) return;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin > 0) set('workHours', diffMin / 60);
  }, [form.startTime, form.endTime]);

  function set(field: keyof Appointment, value: unknown) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.carModel || !form.advisor || !form.clientName || !form.startTime || !form.endTime) {
      toast.error('Completa los campos requeridos');
      return;
    }
    let saveForm = { ...form };
    const conflict = findConflict(existingAppointments, saveForm, initial?.id);
    if (conflict) {
      if (initial?.id) {
        // Editing — keep the blocking behavior so the user decides
        toast.error(
          `Conflicto: ${formatRamp(saveForm.ramp ?? null)} ya tiene a "${conflict.clientName}" de ${conflict.startTime} a ${conflict.endTime}`,
          { duration: 5000 },
        );
        return;
      }
      // New appointment — auto-shift to the next available slot
      const next = findNextSlot(existingAppointments, saveForm);
      if (!next) {
        toast.error(
          `Sin espacio disponible en ${formatRamp(saveForm.ramp ?? null)} para este horario.`,
          { duration: 5000 },
        );
        return;
      }
      toast(
        `${formatRamp(saveForm.ramp ?? null)} ocupada a las ${saveForm.startTime}. Cita movida al siguiente horario disponible: ${next.startTime} – ${next.endTime}.`,
        { icon: '📅', duration: 6000 },
      );
      const newDuration = timeToMinutes(next.endTime) - timeToMinutes(next.startTime);
      saveForm = { ...saveForm, startTime: next.startTime, endTime: next.endTime, workHours: newDuration / 60 };
    }

    setSaving(true);
    try {
      const data = { ...saveForm } as Appointment;
      if (initial?.id) {
        await updateAppointment(initial.id, data);
        toast.success('Cita actualizada');
      } else {
        await createAppointment(data);
        toast.success('Cita creada');
      }
      if (data.status === 'CARRY_OVER') {
        try {
          await createPendingCase({
            date: data.date,
            carModel: data.carModel,
            vin: data.serialNumber ?? '',
            reason: 'Carry Over',
            clientName: data.clientName,
            clientPhone: data.clientPhone ?? '',
            workOrder: data.workOrder ?? '',
            comment: '',
            partNumber: '',
            status: 'PENDIENTE',
          });
          toast('Caso añadido a Casos Pendientes', { icon: '📋', duration: 4000 });
        } catch {
          toast.error('No se pudo crear el caso pendiente automáticamente');
        }
      }
      onSaved();
    } catch {
      toast.error('Error al guardar la cita');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

  const showMaintenance = ['SERVICIO', 'SERVICIO_DIAGNOSTICO', 'SERVICIO_GARANTIA', 'SIN_CITA'].includes(form.serviceType ?? '');
  const showWarranty = ['GARANTIA', 'SERVICIO_GARANTIA', 'GARANTIA_DIAGNOSTICO'].includes(form.serviceType ?? '') ||
    (form.serviceType === 'SIN_CITA' && form.sinCitaSubtype === 'GARANTIA');
  const showDiagnosis = ['DIAGNOSTICO', 'SERVICIO_DIAGNOSTICO', 'GARANTIA_DIAGNOSTICO'].includes(form.serviceType ?? '') ||
    (form.serviceType === 'SIN_CITA' && form.sinCitaSubtype === 'DIAGNOSTICO');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {initial?.id ? 'Editar cita' : 'Nueva cita'} — {date}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Tipo de servicio */}
          <div>
            <label className={labelCls}>Tipo de servicio *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SERVICE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('serviceType', t)}
                  className={`text-xs px-3 py-2 rounded-lg border font-medium transition-all ${
                    form.serviceType === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {SERVICE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Sin cita subtype */}
          {form.serviceType === 'SIN_CITA' && (
            <div>
              <label className={labelCls}>Subtipo sin cita</label>
              <select className={inputCls} value={form.sinCitaSubtype ?? ''} onChange={(e) => set('sinCitaSubtype', e.target.value)}>
                <option value="">— Seleccionar —</option>
                <option value="MANTENIMIENTO">Mantenimiento</option>
                <option value="GARANTIA">Garantía</option>
                <option value="DIAGNOSTICO">Diagnóstico</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Modelo */}
            <div>
              <label className={labelCls}>Modelo del auto *</label>
              {catalogsLoading ? (
                <div className={`${inputCls} text-gray-400 cursor-wait`}>Cargando...</div>
              ) : carModels.length > 0 ? (
                <select className={inputCls} value={form.carModel ?? ''} onChange={(e) => set('carModel', e.target.value)} required>
                  <option value="">— Seleccionar —</option>
                  {carModels.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              ) : (
                <input className={inputCls} placeholder="Ej. BYD Shark" value={form.carModel ?? ''} onChange={(e) => set('carModel', e.target.value)} required />
              )}
            </div>

            {/* Número de serie / VIN */}
            <div>
              <label className={labelCls}>Número de serie (VIN)</label>
              <input className={inputCls} placeholder="LPE19W2A..." value={form.serialNumber ?? ''} onChange={(e) => set('serialNumber', e.target.value)} />
            </div>
          </div>

          {/* Maintenance level */}
          {showMaintenance && (
            <div>
              <label className={labelCls}>Nivel de mantenimiento</label>
              <div className="flex gap-2 flex-wrap">
                {MAINTENANCE_LEVELS.map((n) => (
                  <button key={n} type="button" onClick={() => set('maintenanceLevel', n)}
                    className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
                      form.maintenanceLevel === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}>
                    S{n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showWarranty && (
            <div>
              <label className={labelCls}>Tipo de garantía</label>
              <input className={inputCls} placeholder="Ej. Garantía de fábrica" value={form.warrantyType ?? ''} onChange={(e) => set('warrantyType', e.target.value)} />
            </div>
          )}

          {showDiagnosis && (
            <div>
              <label className={labelCls}>Tipo de diagnóstico</label>
              <input className={inputCls} placeholder="Ej. Revisión de escáner" value={form.diagnosisType ?? ''} onChange={(e) => set('diagnosisType', e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Cliente */}
            <div>
              <label className={labelCls}>Nombre del cliente *</label>
              <input className={inputCls} value={form.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input className={inputCls} type="tel" value={form.clientPhone ?? ''} onChange={(e) => set('clientPhone', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Asesor */}
            <div>
              <label className={labelCls}>Asesor *</label>
              {catalogsLoading ? (
                <div className={`${inputCls} text-gray-400 cursor-wait`}>Cargando...</div>
              ) : advisors.length > 0 ? (
                <select className={inputCls} value={form.advisor ?? ''} onChange={(e) => set('advisor', e.target.value)} required>
                  <option value="">— Seleccionar —</option>
                  {advisors.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              ) : (
                <input className={inputCls} placeholder="Agregar asesor en Configuración" value={form.advisor ?? ''} onChange={(e) => set('advisor', e.target.value)} required />
              )}
            </div>

            {/* Rampa */}
            <div>
              <label className={labelCls}>Rampa</label>
              <select className={inputCls} value={form.ramp?.toString() ?? 'none'} onChange={(e) => set('ramp', e.target.value === 'none' ? null : parseInt(e.target.value) as Ramp)}>
                <option value="none">Sin rampa</option>
                {([1,2,3,4,5,6] as Ramp[]).map((r) => <option key={r} value={r}>{formatRamp(r)}</option>)}
              </select>
            </div>

            {/* Orden de trabajo */}
            <div>
              <label className={labelCls}>Orden de trabajo</label>
              <input className={inputCls} value={form.workOrder ?? ''} onChange={(e) => set('workOrder', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* Hora inicio */}
            <div>
              <label className={labelCls}>Hora inicio *</label>
              <select className={inputCls} value={form.startTime ?? '08:00'} onChange={(e) => set('startTime', e.target.value)} required>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Hora fin */}
            <div>
              <label className={labelCls}>Hora fin *</label>
              <select className={inputCls} value={form.endTime ?? '09:00'} onChange={(e) => set('endTime', e.target.value)} required>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Horas de trabajo — calculado automáticamente */}
            <div>
              <label className={labelCls}>Horas trabajo</label>
              <div className={`${inputCls} bg-gray-50 text-gray-600 cursor-default select-none`}>
                {(form.workHours ?? 0) > 0 ? `${form.workHours} h` : '—'}
              </div>
            </div>

            {/* KM */}
            <div>
              <label className={labelCls}>Kilómetros</label>
              <input className={inputCls} type="number" min={0} value={form.km ?? ''} onChange={(e) => set('km', parseInt(e.target.value) || undefined)} />
            </div>
          </div>

          {/* App BYD & Factura */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.appByd ?? false} onChange={(e) => set('appByd', e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm font-medium text-gray-700">App BYD Activa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.invoice ?? false} onChange={(e) => set('invoice', e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm font-medium text-gray-700">Factura</span>
            </label>
          </div>

          {/* Estado */}
          <div>
            <label className={labelCls}>Estado</label>
            <select className={inputCls} value={form.status ?? 'PROGRAMADO'} onChange={(e) => set('status', e.target.value as AppointmentStatus)}>
              <option value="RECIBIDO">Recibido</option>
              <option value="PROGRAMADO">Programado</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="COMPLETADO">Completado</option>
              <option value="LAVADO">Lavado</option>
              <option value="NO_SHOW">No show</option>
              <option value="ESPERANDO_REFACCION">Esperando refacción</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="CARRY_OVER">Carry Over</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls}>Notas adicionales</label>
            <textarea className={inputCls} rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {saving ? 'Guardando...' : initial?.id ? 'Actualizar' : 'Crear cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
