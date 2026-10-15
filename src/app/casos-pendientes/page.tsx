'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PendingCase } from '@/types';
import { subscribeToPendingCases, createPendingCase, updatePendingCase, deletePendingCase } from '@/lib/firestore/pendingCases';
import { todayISO, isoToDisplay } from '@/lib/utils';
import { Plus, Trash, PencilSimple, X, ClipboardText } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { useSearch } from '@/context/SearchContext';
import { PageHeader } from '@/components/ui/primitives';
import { DataTable, useDataTable, type DataTableColumn } from '@/components/ui/DataTable';
import {
  PENDING_CASE_STATUS_LABELS as STATUS_LABELS,
  PENDING_CASE_STATUS_COLORS as STATUS_COLORS,
} from '@/lib/status';

// ── Column definitions ────────────────────────────────────────────────────────

type ColKey = 'date' | 'carModel' | 'vin' | 'workOrder' | 'reason' | 'clientName' | 'clientPhone' | 'comment' | 'partNumber' | 'status';

const COLUMNS: DataTableColumn<ColKey>[] = [
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

  const [confirmDelete, setConfirmDelete] = useState<PendingCase | null>(null);
  const { query } = useSearch();

  const table = useDataTable<PendingCase, ColKey>({
    rows: cases,
    columns: COLUMNS,
    getValue: getColValue,
    getRowKey: (c) => c.id ?? `${c.date}-${c.vin}-${c.partNumber}`,
    externalSearch: query,
  });

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

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-400';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

  return (
    <AppShell>
      <div className="px-6 py-7 space-y-5 max-w-screen-xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Casos Pendientes"
          description="Refacciones, cargadores y garantías en espera"
        >
          {table.activeFilterCount > 0 && (
            <button
              onClick={table.clearFilters}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              Limpiar {table.activeFilterCount} filtro{table.activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 text-white text-sm font-semibold hover:bg-accent-700 active:scale-[0.98] transition-all shadow-lg shadow-accent-600/20"
          >
            <Plus size={16} />
            Nuevo caso
          </button>
        </PageHeader>

        {/* Table */}
        <DataTable<PendingCase, ColKey>
          controls={table}
          loading={loading}
          actionsWidth={ACTIONS_W}
          rowClassName={() => 'hover:bg-gray-50/60'}
          empty={
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <ClipboardText size={22} className="text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">No hay casos pendientes</p>
              <p className="text-xs text-gray-500">Las refacciones, cargadores o garantías en espera aparecerán aquí.</p>
            </div>
          }
          renderCell={(c, key) => {
            switch (key) {
              case 'date':
                return isoToDisplay(c.date);
              case 'carModel':
                return <span className="font-medium text-gray-800">{c.carModel}</span>;
              case 'vin':
                return <span className="font-mono">{c.vin}</span>;
              case 'workOrder':
                return c.workOrder;
              case 'reason':
                return c.reason;
              case 'clientName':
                return <span className="text-gray-800">{c.clientName}</span>;
              case 'clientPhone':
                return c.clientPhone;
              case 'comment':
                return c.comment;
              case 'partNumber':
                return <span className="font-mono">{c.partNumber}</span>;
              case 'status':
                return (
                  <button
                    onClick={() => toggleStatus(c)}
                    title="Cambiar estado"
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500 border border-gray-300'}`}
                  >
                    {STATUS_LABELS[c.status] ?? c.status}
                  </button>
                );
            }
          }}
          renderActions={(c) => (
            <>
              <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-lg hover:bg-accent-50 text-accent-500 transition-colors">
                <PencilSimple size={14} />
              </button>
              <button onClick={() => handleDelete(c)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                <Trash size={14} />
              </button>
            </>
          )}
        />
      </div>

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
                  <select className={inputCls} value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value as PendingCase['status'] }))}>
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
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-accent-600 text-white text-sm font-semibold hover:bg-accent-700 disabled:opacity-60">
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
          message={`${confirmDelete.clientName}, ${confirmDelete.carModel}`}
          detail={confirmDelete.workOrder ? `Orden de trabajo: ${confirmDelete.workOrder}` : undefined}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeleteConfirmed(confirmDelete)}
        />
      )}
    </AppShell>
  );
}
