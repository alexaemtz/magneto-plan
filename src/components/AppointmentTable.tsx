'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { createPortal } from 'react-dom';
import { Appointment, AppointmentStatus, ServiceType } from '@/types';
import { SERVICE_LABELS } from '@/lib/utils';
import { deleteAppointment } from '@/lib/firestore/appointments';
import AppointmentForm from './AppointmentForm';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Search, Pencil, Trash2, Eye, X,
  ChevronUp, ChevronDown, ChevronsUpDown,
  Filter, Phone, Clock, FileText,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADO:          'Programado',
  EN_PROCESO:          'En proceso',
  COMPLETADO:          'Completado',
  LAVADO:              'Lavado',
  NO_SHOW:             'No show',
  ESPERANDO_REFACCION: 'Esperando refacción',
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  PROGRAMADO:          'bg-blue-100 text-blue-700',
  EN_PROCESO:          'bg-amber-100 text-amber-700',
  COMPLETADO:          'bg-green-100 text-green-700',
  LAVADO:              'bg-sky-100 text-sky-600',
  NO_SHOW:             'bg-gray-100 text-gray-500',
  ESPERANDO_REFACCION: 'bg-orange-100 text-orange-700',
};

const SERVICE_BADGE: Record<ServiceType, string> = {
  SERVICIO:             'bg-blue-50 text-blue-700',
  GARANTIA:             'bg-orange-50 text-orange-700',
  DIAGNOSTICO:          'bg-purple-50 text-purple-700',
  SERVICIO_DIAGNOSTICO: 'bg-indigo-50 text-indigo-700',
  SERVICIO_GARANTIA:    'bg-amber-50 text-amber-700',
  SIN_CITA:             'bg-rose-50 text-rose-700',
};

type ColKey = 'date' | 'startTime' | 'advisor' | 'clientName' | 'carModel' | 'serviceType' | 'ramp' | 'status';

const COLUMNS: { key: ColKey; label: string; defaultWidth: number }[] = [
  { key: 'date',        label: 'Fecha',    defaultWidth: 110 },
  { key: 'startTime',   label: 'Hora',     defaultWidth: 110 },
  { key: 'advisor',     label: 'Asesor',   defaultWidth: 145 },
  { key: 'clientName',  label: 'Cliente',  defaultWidth: 155 },
  { key: 'carModel',    label: 'Modelo',   defaultWidth: 135 },
  { key: 'serviceType', label: 'Tipo',     defaultWidth: 185 },
  { key: 'ramp',        label: 'Rampa',    defaultWidth: 85  },
  { key: 'status',      label: 'Estado',   defaultWidth: 155 },
];

const ACTIONS_W = 116;

function getColValue(a: Appointment, key: ColKey): string {
  switch (key) {
    case 'date':        return a.date;
    case 'startTime':   return `${a.startTime}–${a.endTime}`;
    case 'advisor':     return a.advisor ?? '';
    case 'clientName':  return a.clientName ?? '';
    case 'carModel':    return a.carModel ?? '';
    case 'serviceType': return SERVICE_LABELS[a.serviceType] ?? a.serviceType;
    case 'ramp':        return a.ramp != null ? `Rampa ${a.ramp}` : 'Sin rampa';
    case 'status':      return STATUS_LABELS[a.status] ?? a.status;
  }
}

// ── Filter dropdown (portal — siempre visible, sin verse cortado por el scroll) ──

type FilterAnchor = { col: ColKey; top: number; left: number };

function FilterDropdown({
  col, top, left, appointments, active, onClose, onChange,
}: {
  col: ColKey;
  top: number;
  left: number;
  appointments: Appointment[];
  active: Set<string>;
  onClose: () => void;
  onChange: (v: Set<string>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const unique = useMemo(
    () => [...new Set(appointments.map((a) => getColValue(a, col)))].sort(),
    [appointments, col],
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function toggle(v: string) {
    const next = new Set(active);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      className="w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 max-h-72 overflow-y-auto"
    >
      <div className="flex items-center justify-between px-3 pb-2 border-b border-gray-100 mb-1">
        <span className="text-xs font-semibold text-gray-400 tracking-wide">FILTRAR</span>
        {active.size > 0 && (
          <button onClick={() => onChange(new Set())} className="text-xs text-red-500 hover:text-red-700 font-medium">
            Limpiar
          </button>
        )}
      </div>
      {unique.length === 0
        ? <p className="px-3 py-2 text-xs text-gray-400">Sin valores</p>
        : unique.map((v) => (
          <label key={v} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5"
              checked={active.has(v)}
              onChange={() => toggle(v)}
            />
            <span className="text-xs text-gray-700 truncate">{v || '—'}</span>
          </label>
        ))
      }
    </div>,
    document.body,
  );
}

// ── View panel ────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">
        {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)}
      </p>
    </div>
  );
}

function ViewPanel({ appt, onClose, onEdit, canEdit }: { appt: Appointment; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[400px] bg-white shadow-2xl border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div>
          <p className="text-xs text-gray-400 font-medium">{appt.date}</p>
          <p className="font-semibold text-gray-800 text-sm leading-tight mt-0.5">{appt.clientName}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Pencil size={12} /> Editar
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex gap-2 px-5 py-3 border-b border-gray-100">
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', SERVICE_BADGE[appt.serviceType])}>
          {SERVICE_LABELS[appt.serviceType]}
        </span>
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_COLORS[appt.status])}>
          {STATUS_LABELS[appt.status]}
        </span>
      </div>

      {/* Detail grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-3">Cliente</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Nombre" value={appt.clientName} />
            <Field label="Teléfono" value={appt.clientPhone} />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-3">Vehículo</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Modelo" value={appt.carModel} />
            <Field label="VIN" value={appt.serialNumber} />
            <Field label="Kilómetros" value={appt.km != null ? `${appt.km} km` : undefined} />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-3">Servicio</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Asesor" value={appt.advisor} />
            <Field label="Rampa" value={appt.ramp != null ? `Rampa ${appt.ramp}` : 'Sin rampa'} />
            <Field label="Orden de trabajo" value={appt.workOrder} />
            <Field label="Nivel mantenimiento" value={appt.maintenanceLevel != null ? `S${appt.maintenanceLevel}` : undefined} />
            <Field label="Tipo de garantía" value={appt.warrantyType} />
            <Field label="Tipo de diagnóstico" value={appt.diagnosisType} />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-3">Horario</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Hora inicio" value={appt.startTime} />
            <Field label="Hora fin" value={appt.endTime} />
            <Field label="Horas trabajo" value={appt.workHours != null ? `${appt.workHours} h` : undefined} />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-3">Extras</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="App BYD" value={appt.appByd} />
            <Field label="Factura" value={appt.invoice} />
          </div>
        </section>

        {appt.notes && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-2">Notas</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-80 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">¿Eliminar cita?</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {appt.clientName} — {appt.carModel}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{appt.date} · {appt.startTime}</p>
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

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sortCol, sortDir }: { col: ColKey; sortCol: ColKey | null; sortDir: 'asc' | 'desc' | null }) {
  if (sortCol !== col) return <ChevronsUpDown size={13} className="text-gray-300 shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-blue-500 shrink-0" />
    : <ChevronDown size={13} className="text-blue-500 shrink-0" />;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  appointments: Appointment[];
  date: string;
  onRefresh: () => void;
}

export default function AppointmentTable({ appointments, date, onRefresh }: Props) {
  const perms = usePermissions('gantt');
  const [search, setSearch]                 = useState('');
  const [sortCol, setSortCol]               = useState<ColKey | null>(null);
  const [sortDir, setSortDir]               = useState<'asc' | 'desc' | null>(null);
  const [colWidths, setColWidths]           = useState<Record<ColKey, number>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColKey, number>,
  );
  const [filters, setFilters]               = useState<Partial<Record<ColKey, Set<string>>>>({});
  const [openFilter, setOpenFilter]         = useState<FilterAnchor | null>(null);
  const [viewAppt, setViewAppt]             = useState<Appointment | null>(null);
  const [editAppt, setEditAppt]             = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<Appointment | null>(null);
  const [deleting, setDeleting]             = useState(false);

  const resizeRef = useRef<{ col: ColKey; startX: number; startW: number } | null>(null);

  // ── Column resize ──────────────────────────────────────────────────────────

  function startResize(col: ColKey, e: React.MouseEvent) {
    e.preventDefault();
    resizeRef.current = { col, startX: e.clientX, startW: colWidths[col] };

    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const { col: c, startX, startW } = resizeRef.current;
      setColWidths((prev) => ({ ...prev, [c]: Math.max(60, startW + ev.clientX - startX) }));
    }

    function onUp() {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ── Sort ──────────────────────────────────────────────────────────────────

  function handleSort(col: ColKey) {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir(null); }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  // ── Filtered + sorted data ─────────────────────────────────────────────────

  const rows = useMemo(() => {
    let result = appointments;

    // Global search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((a) =>
        [a.clientName, a.advisor, a.carModel, a.date, a.startTime, a.endTime,
         SERVICE_LABELS[a.serviceType], STATUS_LABELS[a.status], a.workOrder, a.serialNumber]
          .some((v) => v?.toLowerCase().includes(q)),
      );
    }

    // Column filters
    for (const [col, vals] of Object.entries(filters)) {
      if (!vals || vals.size === 0) continue;
      result = result.filter((a) => vals.has(getColValue(a, col as ColKey)));
    }

    // Sort
    if (sortCol && sortDir) {
      result = [...result].sort((a, b) => {
        const av = getColValue(a, sortCol);
        const bv = getColValue(b, sortCol);
        return sortDir === 'asc' ? av.localeCompare(bv, 'es') : bv.localeCompare(av, 'es');
      });
    }

    return result;
  }, [appointments, search, filters, sortCol, sortDir]);

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAppointment(deleteTarget.id!, deleteTarget.date);
      toast.success('Cita eliminada');
      setDeleteTarget(null);
      if (viewAppt?.id === deleteTarget.id) setViewAppt(null);
      onRefresh();
    } catch {
      toast.error('Error al eliminar la cita');
    } finally {
      setDeleting(false);
    }
  }

  const activeFilterCount = Object.values(filters).filter((s) => s && s.size > 0).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 relative">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, asesor, modelo, hora…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-800 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          {activeFilterCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
              <Filter size={11} />
              {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''} activo{activeFilterCount > 1 ? 's' : ''}
              <button onClick={() => setFilters({})} className="ml-1 hover:text-blue-900">
                <X size={11} />
              </button>
            </span>
          )}
          <span className="text-xs text-gray-400">{rows.length} / {appointments.length} citas</span>
        </div>
      </div>

      {/* Table wrapper */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="table-fixed border-collapse w-full" style={{ minWidth: COLUMNS.reduce((s, c) => s + colWidths[c.key], 0) + ACTIONS_W }}>
          <colgroup>
            {COLUMNS.map((c) => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
            <col style={{ width: ACTIONS_W }} />
          </colgroup>

          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {COLUMNS.map((col) => {
                const hasFilter = (filters[col.key]?.size ?? 0) > 0;
                return (
                  <th
                    key={col.key}
                    className="relative select-none text-left px-3 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap border-r border-gray-200 last:border-r-0"
                  >
                    <div className="flex items-center gap-1.5 pr-5">
                      {/* Sort trigger */}
                      <button
                        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
                      </button>

                      {/* Filter trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilter?.col === col.key) { setOpenFilter(null); return; }
                          const r = e.currentTarget.getBoundingClientRect();
                          // Evita que el dropdown salga por la derecha de la pantalla
                          const left = Math.min(r.left, window.innerWidth - 236);
                          setOpenFilter({ col: col.key, top: r.bottom + 4, left });
                        }}
                        className={cn(
                          'p-0.5 rounded transition-colors',
                          hasFilter ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500',
                        )}
                      >
                        <Filter size={11} />
                      </button>
                    </div>

                    {/* Filter dropdown — renderizado en document.body vía portal */}
                    {openFilter?.col === col.key && (
                      <FilterDropdown
                        col={col.key}
                        top={openFilter.top}
                        left={openFilter.left}
                        appointments={appointments}
                        active={filters[col.key] ?? new Set()}
                        onClose={() => setOpenFilter(null)}
                        onChange={(v) => setFilters((prev) => ({ ...prev, [col.key]: v }))}
                      />
                    )}

                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                      onMouseDown={(e) => startResize(col.key, e)}
                    />
                  </th>
                );
              })}

              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center bg-gray-50">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="py-14 text-center text-sm text-gray-400">
                  {appointments.length === 0 ? 'No hay citas para esta fecha' : 'Sin resultados para los filtros aplicados'}
                </td>
              </tr>
            ) : (
              rows.map((appt) => (
                <tr
                  key={appt.id}
                  className={cn(
                    'transition-colors hover:bg-blue-50/40',
                    viewAppt?.id === appt.id && 'bg-blue-50',
                  )}
                >
                  {/* date */}
                  <td className="px-3 py-2.5 text-xs text-gray-600 border-r border-gray-100 whitespace-nowrap truncate">
                    {appt.date}
                  </td>
                  {/* hora */}
                  <td className="px-3 py-2.5 text-xs text-gray-700 font-mono border-r border-gray-100 whitespace-nowrap truncate">
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-gray-400 shrink-0" />
                      {appt.startTime}–{appt.endTime}
                    </span>
                  </td>
                  {/* asesor */}
                  <td className="px-3 py-2.5 text-xs text-gray-800 font-medium border-r border-gray-100 truncate">
                    {appt.advisor || '—'}
                  </td>
                  {/* cliente */}
                  <td className="px-3 py-2.5 border-r border-gray-100 truncate">
                    <p className="text-xs font-semibold text-gray-800 truncate">{appt.clientName}</p>
                    {appt.clientPhone && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                        <Phone size={9} />{appt.clientPhone}
                      </p>
                    )}
                  </td>
                  {/* modelo */}
                  <td className="px-3 py-2.5 text-xs text-gray-700 border-r border-gray-100 truncate">
                    {appt.carModel || '—'}
                  </td>
                  {/* tipo */}
                  <td className="px-3 py-2.5 border-r border-gray-100">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap', SERVICE_BADGE[appt.serviceType])}>
                      {SERVICE_LABELS[appt.serviceType]}
                    </span>
                  </td>
                  {/* rampa */}
                  <td className="px-3 py-2.5 text-xs text-gray-600 text-center border-r border-gray-100">
                    {appt.ramp != null
                      ? <span className="font-semibold text-gray-800">{appt.ramp}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  {/* estado */}
                  <td className="px-3 py-2.5 border-r border-gray-100">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap', STATUS_COLORS[appt.status])}>
                      {STATUS_LABELS[appt.status]}
                    </span>
                  </td>
                  {/* acciones */}
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setViewAppt(viewAppt?.id === appt.id ? null : appt)}
                        title="Ver detalle"
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          viewAppt?.id === appt.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
                        )}
                      >
                        <Eye size={14} />
                      </button>
                      {perms.update && (
                        <button
                          onClick={() => setEditAppt(appt)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {perms.delete && (
                        <button
                          onClick={() => setDeleteTarget(appt)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
