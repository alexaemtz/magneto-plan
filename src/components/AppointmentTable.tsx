'use client';

import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { formatRamp, SERVICE_LABELS, cn } from '@/lib/utils';
import { Appointment } from '@/types';
import { deleteAppointment } from '@/lib/firestore/appointments';
import AppointmentForm from './AppointmentForm';
import toast from 'react-hot-toast';
import {
  MagnifyingGlass, PencilSimple, Trash, Eye, X,
  Funnel, Phone, Clock, FileText,
} from '@phosphor-icons/react';
import {
  APPOINTMENT_STATUS_LABELS as STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS as STATUS_COLORS,
} from '@/lib/status';
import { DataTable, useDataTable, type DataTableColumn, type DataTableControls } from '@/components/ui/DataTable';

type ColKey = 'date' | 'startTime' | 'advisor' | 'tecnico' | 'clientName' | 'carModel' | 'vin' | 'serviceType' | 'ramp' | 'status' | 'workOrder' | 'campaña';

const COLUMNS: DataTableColumn<ColKey>[] = [
  { key: 'date',        label: 'Fecha',            defaultWidth: 110 },
  { key: 'startTime',   label: 'Hora',             defaultWidth: 110 },
  { key: 'workOrder',   label: 'Orden de trabajo', defaultWidth: 130 },
  { key: 'advisor',     label: 'Asesor',           defaultWidth: 135 },
  { key: 'tecnico',     label: 'Técnico',          defaultWidth: 135 },
  { key: 'clientName',  label: 'Cliente',          defaultWidth: 155 },
  { key: 'carModel',    label: 'Modelo',           defaultWidth: 135 },
  { key: 'vin',         label: 'VIN',              defaultWidth: 150 },
  { key: 'serviceType', label: 'Tipo',             defaultWidth: 185 },
  { key: 'ramp',        label: 'Rampa',            defaultWidth: 85,  align: 'center' },
  { key: 'status',      label: 'Estado',           defaultWidth: 155 },
  { key: 'campaña',     label: 'Campaña',          defaultWidth: 85,  align: 'center' },
];

const ACTIONS_W = 116;

function getColValue(a: Appointment, key: ColKey): string {
  switch (key) {
    case 'date':        return a.date;
    case 'startTime':   return `${a.startTime}–${a.endTime}`;
    case 'advisor':     return a.advisor ?? '';
    case 'tecnico':     return a.tecnico ?? '';
    case 'clientName':  return a.clientName ?? '';
    case 'carModel':    return a.carModel ?? '';
    case 'vin':         return a.serialNumber ?? '';
    case 'serviceType': return SERVICE_LABELS[a.serviceType] ?? a.serviceType;
    case 'ramp':        return formatRamp(a.ramp);
    case 'status':      return STATUS_LABELS[a.status] ?? a.status;
    case 'workOrder':   return a.workOrder ?? '';
    case 'campaña':     return a.campaña ? 'Sí' : 'No';
  }
}

// ── View panel ────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">
        {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)}
      </p>
    </div>
  );
}

function ViewPanel({ appt, onClose, onEdit, canEdit }: { appt: Appointment; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[400px] bg-white shadow-2xl border-l border-gray-200 flex flex-col drawer-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div>
          <p className="text-xs text-gray-500 font-medium">{appt.date}</p>
          <p className="font-semibold text-gray-800 text-sm leading-tight mt-0.5">{appt.clientName}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-600 text-white text-xs font-semibold hover:bg-accent-700 transition-colors"
            >
              <PencilSimple size={12} /> Editar
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex gap-2 px-5 py-3 border-b border-gray-100">
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-600 border-slate-200">
          {SERVICE_LABELS[appt.serviceType]}
        </span>
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_COLORS[appt.status])}>
          {STATUS_LABELS[appt.status]}
        </span>
      </div>

      {/* Detail grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        <section>
          <p className="text-xs font-semibold text-gray-500 mb-3">Cliente</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Nombre" value={appt.clientName} />
            <Field label="Teléfono" value={appt.clientPhone} />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-gray-500 mb-3">Vehículo</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Modelo" value={appt.carModel} />
            <Field label="VIN" value={appt.serialNumber} />
            <Field label="Kilómetros" value={appt.km != null ? `${appt.km} km` : undefined} />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-gray-500 mb-3">Servicio</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Asesor" value={appt.advisor} />
            <Field label="Técnico" value={appt.tecnico} />
            <Field label="Rampa" value={formatRamp(appt.ramp)} />
            <Field label="Orden de trabajo" value={appt.workOrder} />
            <Field label="Nivel mantenimiento" value={appt.maintenanceLevel != null ? `S${appt.maintenanceLevel}` : undefined} />
            <Field label="Tipo de garantía" value={appt.warrantyType} />
            <Field label="Tipo de diagnóstico" value={appt.diagnosisType} />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-gray-500 mb-3">Horario</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Hora inicio" value={appt.startTime} />
            <Field label="Hora fin" value={appt.endTime} />
            <Field label="Horas trabajo" value={appt.workHours != null ? `${appt.workHours} h` : undefined} />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold text-gray-500 mb-3">Extras</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="App BYD" value={appt.appByd} />
            <Field label="Factura" value={appt.invoice} />
            <Field label="Campaña" value={appt.campaña} />
          </div>
        </section>

        {appt.notes && (
          <section>
            <p className="text-xs font-semibold text-gray-500 mb-2">Notas</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5">{appt.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({ appt, onCancel, onConfirm }: {
  appt: Appointment;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-80 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash size={16} className="text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">¿Eliminar cita?</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {appt.clientName}, {appt.carModel}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{appt.date}, {appt.startTime}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  appointments: Appointment[];
  onRefresh: () => void;
  searchQuery?: string;
  /** When set, the table paginates internally (all rows are expected). */
  pageSize?: number;
  /** Footer rendered below the table with access to the table controls. */
  renderFooter?: (controls: DataTableControls<Appointment, ColKey>) => React.ReactNode;
}

export default function AppointmentTable({ appointments, onRefresh, searchQuery, pageSize, renderFooter }: Props) {
  const perms = usePermissions('gantt');
  const [viewAppt, setViewAppt]       = useState<Appointment | null>(null);
  const [editAppt, setEditAppt]       = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  const table = useDataTable<Appointment, ColKey>({
    rows: appointments,
    columns: COLUMNS,
    getValue: getColValue,
    getRowKey: (a) => a.id ?? `${a.date}-${a.startTime}-${a.serialNumber}`,
    externalSearch: searchQuery,
    pageSize,
    getSearchText: (a) => [
      a.clientName, a.advisor, a.tecnico, a.carModel, a.date, a.startTime, a.endTime,
      SERVICE_LABELS[a.serviceType], STATUS_LABELS[a.status], a.workOrder, a.serialNumber,
      a.campaña ? 'campaña campana' : '',
    ].join(' '),
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAppointment(deleteTarget.id!, deleteTarget.date);
      toast.success('Cita eliminada');
      setDeleteTarget(null);
      if (viewAppt?.id === deleteTarget.id) setViewAppt(null);
      onRefresh();
    } catch {
      toast.error('Error al eliminar la cita');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 relative">
      <DataTable<Appointment, ColKey>
        controls={table}
        actionsWidth={ACTIONS_W}
        rowClassName={(appt) => cn('hover:bg-accent-50/40', viewAppt?.id === appt.id && 'bg-accent-50')}
        empty={appointments.length === 0 ? 'No hay citas para esta fecha' : 'Sin resultados para los filtros aplicados'}
        renderFooter={renderFooter}
        renderToolbar={(t) => (
          <div className="flex items-center gap-3 flex-wrap">
            {t.searchable && (
              <div className="relative flex-1 min-w-56 max-w-sm">
                <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={t.search}
                  onChange={(e) => t.setSearch(e.target.value)}
                  placeholder="Buscar por cliente, asesor, modelo, hora…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-800 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-400"
                />
                {t.search && (
                  <button onClick={() => t.setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500">
              {t.activeFilterCount > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-50 text-accent-700 text-xs font-semibold">
                  <Funnel size={11} />
                  {t.activeFilterCount} filtro{t.activeFilterCount > 1 ? 's' : ''} activo{t.activeFilterCount > 1 ? 's' : ''}
                  <button onClick={t.clearFilters} className="ml-1 hover:text-accent-900">
                    <X size={11} />
                  </button>
                </span>
              )}
              <span className="text-xs text-gray-500 tabular">{t.filteredRows.length} / {appointments.length} citas</span>
            </div>
          </div>
        )}
        renderCell={(appt, key) => {
          switch (key) {
            case 'date':
              return appt.date;
            case 'startTime':
              return (
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={11} className="text-gray-500 shrink-0" />
                  {appt.startTime}–{appt.endTime}
                </span>
              );
            case 'workOrder':
              return appt.workOrder ? (
                <span className="flex items-center gap-1">
                  <FileText size={11} className="text-gray-500 shrink-0" />
                  {appt.workOrder}
                </span>
              ) : <span className="text-gray-300">&nbsp;</span>;
            case 'advisor':
              return appt.advisor;
            case 'tecnico':
              return appt.tecnico;
            case 'clientName':
              return (
                <>
                  <p className="text-xs font-semibold text-gray-800 truncate">{appt.clientName}</p>
                  {appt.clientPhone && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-0.5 mt-0.5">
                      <Phone size={9} />{appt.clientPhone}
                    </p>
                  )}
                </>
              );
            case 'carModel':
              return appt.carModel;
            case 'vin':
              return <span className="font-mono text-gray-600">{appt.serialNumber}</span>;
            case 'serviceType':
              return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap border bg-slate-50 text-slate-600 border-slate-200">
                  {SERVICE_LABELS[appt.serviceType]}
                </span>
              );
            case 'ramp':
              return appt.ramp != null
                ? <span className="font-semibold text-gray-800">{appt.ramp}</span>
                : <span className="text-gray-300">&nbsp;</span>;
            case 'status':
              return (
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap', STATUS_COLORS[appt.status])}>
                  {STATUS_LABELS[appt.status]}
                </span>
              );
            case 'campaña':
              return appt.campaña
                ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap">Campaña</span>
                : <span className="text-gray-300">&nbsp;</span>;
          }
        }}
        renderActions={(appt) => (
          <>
            <button
              onClick={() => setViewAppt(viewAppt?.id === appt.id ? null : appt)}
              title="Ver detalle"
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                viewAppt?.id === appt.id
                  ? 'bg-accent-100 text-accent-600'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )}
            >
              <Eye size={14} />
            </button>
            {perms.update && (
              <button
                onClick={() => setEditAppt(appt)}
                title="Editar"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-accent-50 hover:text-accent-600 transition-colors"
              >
                <PencilSimple size={14} />
              </button>
            )}
            {perms.delete && (
              <button
                onClick={() => setDeleteTarget(appt)}
                title="Eliminar"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash size={14} />
              </button>
            )}
          </>
        )}
      />

      {/* View panel */}
      {viewAppt && (
        <ViewPanel
          appt={viewAppt}
          onClose={() => setViewAppt(null)}
          onEdit={() => { setEditAppt(viewAppt); setViewAppt(null); }}
          canEdit={perms.update}
        />
      )}

      {/* Edit dialog */}
      {editAppt && (
        <AppointmentForm
          date={editAppt.date}
          initial={editAppt}
          existingAppointments={appointments}
          onClose={() => setEditAppt(null)}
          onSaved={() => { setEditAppt(null); onRefresh(); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteDialog
          appt={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
