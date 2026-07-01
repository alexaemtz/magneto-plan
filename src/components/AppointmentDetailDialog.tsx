'use client';

import { X, Pencil, Trash2, Clock, Car, User, Phone, Wrench, FileText, Gauge, CheckCircle2, XCircle } from 'lucide-react';
import { Appointment, AppointmentStatus } from '@/types';
import { SERVICE_LABELS, isoToDisplay, cn } from '@/lib/utils';

interface Props {
  appt: Appointment;
  onClose: () => void;
  onEdit: (appt: Appointment) => void;
  onDelete: (appt: Appointment) => void;
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PROGRAMADO:          'Programado',
  EN_PROCESO:          'En proceso',
  COMPLETADO:          'Completado',
  LAVADO:              'Lavado',
  NO_SHOW:             'No show',
  ESPERANDO_REFACCION: 'Esperando refacción',
};

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  PROGRAMADO:          'bg-blue-100 text-blue-700',
  EN_PROCESO:          'bg-amber-100 text-amber-700',
  COMPLETADO:          'bg-green-100 text-green-700',
  LAVADO:              'bg-sky-100 text-sky-600',
  NO_SHOW:             'bg-gray-100 text-gray-500',
  ESPERANDO_REFACCION: 'bg-orange-100 text-orange-700',
};

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
      {icon && <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>}
      {!icon && <span className="w-4 shrink-0" />}
      <span className="text-xs text-gray-500 w-36 shrink-0 font-medium pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium flex-1 min-w-0 break-words">{value}</span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0">
      <span className="w-4 shrink-0" />
      <span className="text-xs text-gray-500 w-36 shrink-0 font-medium">{label}</span>
      <span className={cn('flex items-center gap-1 text-xs font-semibold', value ? 'text-green-600' : 'text-gray-400')}>
        {value
          ? <><CheckCircle2 size={13} /> Sí</>
          : <><XCircle size={13} /> No</>}
      </span>
    </div>
  );
}

export default function AppointmentDetailDialog({ appt, onClose, onEdit, onDelete }: Props) {
  const rampLabel = appt.ramp != null ? `Rampa ${appt.ramp}` : 'Sin rampa';

  function handleDelete() {
    onClose();
    onDelete(appt);
  }

  function handleEdit() {
    onClose();
    onEdit(appt);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900 truncate">{appt.carModel}</h2>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold shrink-0', STATUS_COLOR[appt.status])}>
                {STATUS_LABEL[appt.status]}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {SERVICE_LABELS[appt.serviceType]} · {isoToDisplay(appt.date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          <Row icon={<Clock size={14} />}  label="Horario"    value={`${appt.startTime} – ${appt.endTime}`} />
          <Row icon={<Wrench size={14} />} label="Rampa"      value={rampLabel} />
          <Row icon={<User size={14} />}   label="Asesor"     value={appt.advisor} />
          <Row icon={<User size={14} />}   label="Cliente"    value={appt.clientName} />
          <Row icon={<Phone size={14} />}  label="Teléfono"   value={appt.clientPhone} />
          <Row icon={<Car size={14} />}    label="VIN / Serie" value={appt.serialNumber} />
          <Row icon={<FileText size={14} />} label="Orden de trabajo" value={appt.workOrder} />
          <Row icon={<Gauge size={14} />}  label="Kilómetros" value={appt.km != null ? appt.km.toLocaleString('es-MX') : undefined} />
          <Row label="Horas estimadas"   value={appt.workHours ? `${appt.workHours} h` : undefined} />
          {appt.maintenanceLevel != null && (
            <Row label="Nivel de mantenimiento" value={`Nivel ${appt.maintenanceLevel}`} />
          )}
          {appt.warrantyType && <Row label="Tipo de garantía"   value={appt.warrantyType} />}
          {appt.diagnosisType && <Row label="Tipo de diagnóstico" value={appt.diagnosisType} />}
          {appt.sinCitaSubtype && <Row label="Subtipo sin cita"  value={appt.sinCitaSubtype} />}
          <BoolRow label="App BYD"  value={appt.appByd} />
          <BoolRow label="Factura"  value={appt.invoice} />
          {appt.notes && (
            <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-1">Notas</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{appt.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
            Eliminar
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Pencil size={14} />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
