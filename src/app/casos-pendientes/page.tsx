'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import AppShell from '@/components/AppShell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PendingCase } from '@/types';
import { subscribeToPendingCases, createPendingCase, updatePendingCase, deletePendingCase } from '@/lib/firestore/pendingCases';
import { todayISO, isoToDisplay } from '@/lib/utils';
import { Plus, Trash2, Pencil, X, ChevronUp, ChevronDown, ChevronsUpDown, Filter, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearch } from '@/context/SearchContext';
import { PageHeader, TableSkeleton } from '@/components/ui/primitives';

// ── Column definitions ────────────────────────────────────────────────────────

type ColKey = 'date' | 'carModel' | 'vin' | 'workOrder' | 'reason' | 'clientName' | 'clientPhone' | 'comment' | 'partNumber' | 'status';

const COLUMNS: { key: ColKey; label: string; defaultWidth: number }[] = [
  { key: 'date',        label: 'Fecha',            defaultWidth: 110 },
  { key: 'carModel',    label: 'Modelo',           defaultWidth: 130 },
  { key: 'vin',         label: 'VIN',              defaultWidth: 140 },
  { key: 'workOrder',   label: 'Orden de trabajo', defaultWidth: 140 },
  { key: 'reason',      label: 'Motivo',           defaultWidth: 150 },
  { key: 'clientName',  label: 'Cliente',          defaultWidth: 150 },
  { key: 'clientPhone', label: 'Teléfono',         defaultWidth: 120 },
  { key: 'comment',     label: 'Comentario',       defaultWidth: 160 },
  { key: 'partNumber',  label: 'No. Pieza',        defaultWidth: 120 },
  { key: 'status',      label: 'Estado',           defaultWidth: 130 },
];

const ACTIONS_W = 88;

function getColValue(c: PendingCase, key: ColKey): string {
  switch (key) {
    case 'date':        return isoToDisplay(c.date);
    case 'carModel':    return c.carModel ?? '';
    case 'vin':         return c.vin ?? '';
    case 'workOrder':   return c.workOrder ?? '';
    case 'reason':      return c.reason ?? '';
    case 'clientName':  return c.clientName ?? '';
    case 'clientPhone': return c.clientPhone ?? '';
    case 'comment':     return c.comment ?? '';
    case 'partNumber':  return c.partNumber ?? '';
    case 'status':      return c.status ?? '';
  }
}

// ── Status maps ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE:  'bg-amber-100 text-amber-700 border border-amber-300',
  ENTREGADO:  'bg-green-100 text-green-700 border border-green-300',
  EN_PROCESO: 'bg-blue-100 text-blue-700 border border-blue-300',
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE:  'Pendiente',
  ENTREGADO:  'Entregado',
  EN_PROCESO: 'En proceso',
};

// ── Filter dropdown ───────────────────────────────────────────────────────────

type FilterAnchor = { col: ColKey; top: number; left: number };

function FilterDropdown({ col, top, left, cases, active, onClose, onChange }: {
  col: ColKey; top: number; left: number;
  cases: PendingCase[]; active: Set<string>;
  onClose: () => void; onChange: (v: Set<string>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const unique = useMemo(
    () => [...new Set(cases.map((c) => getColValue(c, col)))].sort(),
    [cases, col],
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
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  }
  return createPortal(
    <div ref={ref} style={{ position: 'fixed', top, left, zIndex: 9999, ['--origin' as string]: 'top left' }}
      className="dropdown-card w-60 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between px-3.5 pb-2 border-b border-gray-100 mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Filtrar</span>
        {active.size > 0 && (
          <button onClick={() => onChange(new Set())} className="text-xs text-red-500 hover:text-red-700 font-medium">Limpiar</button>
        )}
      </div>
      {unique.length === 0
        ? <p className="px-3.5 py-2 text-sm text-gray-400">Sin valores</p>
        : unique.map((v) => (
          <label key={v} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 w-4 h-4"
              checked={active.has(v)} onChange={() => toggle(v)} />
            <span className="text-sm text-gray-700 truncate">{v || 'Sin valor'}</span>
          </label>
        ))
      }
    </div>,
    document.body,
  );
}

function SortIcon({ col, sortCol, sortDir }: { col: ColKey; sortCol: ColKey | null; sortDir: 'asc' | 'desc' | null }) {
  if (sortCol !== col) return <ChevronsUpDown size={13} className="text-gray-300 shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-blue-500 shrink-0" />
    : <ChevronDown size={13} className="text-blue-500 shrink-0" />;
}

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY: Omit<PendingCase, 'id'> = {
  date: todayISO(),
  carModel: '',
  vin: '',
  reason: '',
  clientName: '',
  clientPhone: '',
  comment: '',
  partNumber: '',
  workOrder: '',
  status: 'PENDIENTE',
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CasosPendientesPage() {
  const [cases, setCases] = useState<PendingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCase, setEditCase] = useState<PendingCase | null>(null);
  const [form, setForm] = useState<Omit<PendingCase, 'id'>>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(
    () => Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColKey, number>,
  );
  const [sortCol, setSortCol] = useState<ColKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [filters, setFilters] = useState<Partial<Record<ColKey, Set<string>>>>({});
  const [openFilter, setOpenFilter] = useState<FilterAnchor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PendingCase | null>(null);
  const resizeRef = useRef<{ col: ColKey; startX: number; startW: number } | null>(null);

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const { col, startX, startW } = resizeRef.current;
      setColWidths((prev) => ({ ...prev, [col]: Math.max(60, startW + ev.clientX - startX) }));
    }
    function onUp() { resizeRef.current = null; }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  function startResize(col: ColKey, e: React.MouseEvent) {
    e.preventDefault();
    resizeRef.current = { col, startX: e.clientX, startW: colWidths[col] };
  }

  function handleSort(col: ColKey) {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortCol(null); setSortDir(null); }
  }

  const activeFilterCount = Object.values(filters).filter((s) => s && s.size > 0).length;
  const { query } = useSearch();

  const displayed = useMemo(() => {
    let result = [...cases];

    // Global search bar
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((c) =>
        [c.clientName, c.carModel, c.vin, c.workOrder, c.reason, c.clientPhone, c.partNumber, c.comment, isoToDisplay(c.date)]
          .some((v) => v?.toLowerCase().includes(q))
      );
    }

    for (const [col, vals] of Object.entries(filters) as [ColKey, Set<string>][]) {
      if (vals.size > 0) result = result.filter((c) => vals.has(getColValue(c, col)));
    }
    if (sortCol && sortDir) {
      result.sort((a, b) => {
        const av = getColValue(a, sortCol);
        const bv = getColValue(b, sortCol);
        return sortDir === 'asc' ? av.localeCompare(bv, 'es') : bv.localeCompare(av, 'es');
      });
    }
    return result;
  }, [cases, query, filters, sortCol, sortDir]);

  useEffect(() => {
    const unsub = subscribeToPendingCases((data) => { setCases(data); setLoading(false); });
    return unsub;
  }, []);

  function openNew() { setEditCase(null); setForm({ ...EMPTY }); setShowForm(true); }
  function openEdit(c: PendingCase) { setEditCase(c); setForm({ ...c }); setShowForm(true); }

  async function handleSave() {
    if (!form.carModel || !form.clientName) { toast.error('Completa los campos requeridos'); return; }
    setSaving(true);
    try {
      if (editCase?.id) {
        await updatePendingCase(editCase.id, form);
        toast.success('Caso actualizado');
      } else {
        await createPendingCase(form);
        toast.success('Caso creado');
      }
      setShowForm(false);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(c: PendingCase) {
    setConfirmDelete(c);
  }

  async function handleDeleteConfirmed(c: PendingCase) {
    setConfirmDelete(null);
    await deletePendingCase(c.id!);
    toast.success('Caso eliminado');
  }

  async function toggleStatus(c: PendingCase) {
    const newStatus = c.status === 'ENTREGADO' ? 'PENDIENTE' : 'ENTREGADO';
    await updatePendingCase(c.id!, { status: newStatus });
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

  const tableWidth = COLUMNS.reduce((s, c) => s + colWidths[c.key], 0) + ACTIONS_W;

  return (
    <AppShell>
      <div className="px-6 py-7 space-y-5 max-w-screen-xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Casos Pendientes"
          description="Refacciones, cargadores y garantías en espera"
        >
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters({})}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              Limpiar {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} />
            Nuevo caso
          </button>
        </PageHeader>

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-fixed text-sm" style={{ width: tableWidth }}>
                <colgroup>
                  {COLUMNS.map((c) => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
                  <col style={{ width: ACTIONS_W }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-200">
                    {COLUMNS.map((col) => {
                      const active = filters[col.key] ?? new Set<string>();
                      const hasFilter = active.size > 0;
                      return (
                        <th key={col.key} className="relative px-3 py-3 text-left whitespace-nowrap select-none">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSort(col.key)}
                              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 hover:text-gray-800 min-w-0 truncate"
                            >
                              <span className="truncate">{col.label}</span>
                              <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
                            </button>
                            <button
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenFilter({ col: col.key, top: rect.bottom + 4, left: rect.left });
                              }}
                              className={`p-0.5 rounded hover:bg-gray-200 transition-colors shrink-0 ${hasFilter ? 'text-blue-600' : 'text-gray-400'}`}
                            >
                              <Filter size={11} />
                            </button>
                          </div>
                          <div
                            onMouseDown={(e) => startResize(col.key, e)}
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                          />
                        </th>
                      );
                    })}
                    <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayed.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <ClipboardList size={22} className="text-gray-300" />
                          <p className="text-sm text-gray-500 font-medium">No hay casos pendientes</p>
                          <p className="text-xs text-gray-400">Las refacciones, cargadores o garantías en espera aparecerán aquí.</p>
                        </div>
                      </td>
                    </tr>
                  ) : displayed.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap truncate">{isoToDisplay(c.date)}</td>
                      <td className="px-3 py-3 font-medium text-gray-800 truncate">{c.carModel}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-600 truncate">{c.vin}</td>
                      <td className="px-3 py-3 text-gray-600 truncate">{c.workOrder}</td>
                      <td className="px-3 py-3 text-gray-600 truncate">{c.reason}</td>
                      <td className="px-3 py-3 text-gray-800 whitespace-nowrap truncate">{c.clientName}</td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap truncate">{c.clientPhone}</td>
                      <td className="px-3 py-3 text-gray-600 truncate">{c.comment}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-600 truncate">{c.partNumber}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleStatus(c)}
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500 border border-gray-300'}`}
                        >
                          {STATUS_LABELS[c.status] ?? c.status}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Filter dropdown */}
      {openFilter && (
        <FilterDropdown
          col={openFilter.col}
          top={openFilter.top}
          left={openFilter.left}
          cases={cases}
          active={filters[openFilter.col] ?? new Set()}
          onClose={() => setOpenFilter(null)}
          onChange={(v) => setFilters((p) => ({ ...p, [openFilter.col]: v }))}
        />
      )}

      {/* Modal */}
      {showForm && (
        <div className="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editCase ? 'Editar caso' : 'Nuevo caso pendiente'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Modelo *</label>
                  <input className={inputCls} value={form.carModel} onChange={(e) => setForm(p => ({ ...p, carModel: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>VIN / Número de serie</label>
                  <input className={inputCls} value={form.vin} onChange={(e) => setForm(p => ({ ...p, vin: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Orden de trabajo</label>
                  <input className={inputCls} value={form.workOrder ?? ''} onChange={(e) => setForm(p => ({ ...p, workOrder: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Motivo</label>
                <input className={inputCls} value={form.reason} onChange={(e) => setForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Cliente *</label>
                  <input className={inputCls} value={form.clientName} onChange={(e) => setForm(p => ({ ...p, clientName: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input className={inputCls} value={form.clientPhone} onChange={(e) => setForm(p => ({ ...p, clientPhone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Comentario</label>
                <textarea className={inputCls} rows={2} value={form.comment} onChange={(e) => setForm(p => ({ ...p, comment: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>No. de pieza</label>
                  <input className={inputCls} value={form.partNumber} onChange={(e) => setForm(p => ({ ...p, partNumber: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <select className={inputCls} value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="ENTREGADO">Entregado</option>
                    <option value="EN_PROCESO">En proceso</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Guardando...' : editCase ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar caso?"
          message={`${confirmDelete.clientName} · ${confirmDelete.carModel}`}
          detail={confirmDelete.workOrder ? `Orden de trabajo: ${confirmDelete.workOrder}` : undefined}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeleteConfirmed(confirmDelete)}
        />
      )}
    </AppShell>
  );
}
