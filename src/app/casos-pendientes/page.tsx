'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { PendingCase } from '@/types';
import { getPendingCases, createPendingCase, updatePendingCase, deletePendingCase } from '@/lib/firestore/pendingCases';
import { todayISO, isoToDisplay } from '@/lib/utils';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY: Omit<PendingCase, 'id'> = {
  date: todayISO(),
  carModel: '',
  vin: '',
  reason: '',
  clientName: '',
  clientPhone: '',
  comment: '',
  partNumber: '',
  stock: '',
  status: 'PENDIENTE',
};

export default function CasosPendientesPage() {
  const [cases, setCases] = useState<PendingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCase, setEditCase] = useState<PendingCase | null>(null);
  const [form, setForm] = useState<Omit<PendingCase, 'id'>>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setCases(await getPendingCases());
    } catch (err) {
      console.error('Error cargando casos pendientes:', err);
      toast.error('Error al cargar los casos. Verifica los permisos de Firestore.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditCase(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  }

  function openEdit(c: PendingCase) {
    setEditCase(c);
    setForm({ ...c });
    setShowForm(true);
  }

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
      load();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: PendingCase) {
    if (!confirm(`¿Eliminar caso de ${c.clientName}?`)) return;
    await deletePendingCase(c.id!);
    toast.success('Caso eliminado');
    load();
  }

  async function toggleStatus(c: PendingCase) {
    const newStatus = c.status === 'ENTREGADO' ? 'PENDIENTE' : 'ENTREGADO';
    await updatePendingCase(c.id!, { status: newStatus });
    load();
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400';
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

  const STATUS_COLORS: Record<string, string> = {
    PENDIENTE: 'bg-amber-100 text-amber-700',
    ENTREGADO: 'bg-green-100 text-green-700',
  };

  return (
    <AppShell>
      <div className="px-6 py-6 space-y-5 max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Casos Pendientes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Refacciones, cargadores y garantías en espera</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
          >
            <Plus size={16} />
            Nuevo caso
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Fecha','Modelo','VIN','Motivo','Cliente','Teléfono','Comentario','No. Pieza','Estado','Acciones'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cases.length === 0 ? (
                    <tr><td colSpan={10} className="py-12 text-center text-gray-400">No hay casos pendientes</td></tr>
                  ) : cases.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{isoToDisplay(c.date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{c.carModel}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-32 truncate">{c.vin}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-40 truncate">{c.reason}</td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{c.clientName}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.clientPhone}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-40 truncate">{c.comment}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.partNumber}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(c)}
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {c.status}
                        </button>
                      </td>
                      <td className="px-4 py-3">
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

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editCase ? 'Editar caso' : 'Nuevo caso pendiente'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Modelo *</label>
                  <input className={inputCls} value={form.carModel} onChange={(e) => setForm(p => ({ ...p, carModel: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className={labelCls}>VIN / Número de serie</label>
                <input className={inputCls} value={form.vin} onChange={(e) => setForm(p => ({ ...p, vin: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Motivo</label>
                <input className={inputCls} value={form.reason} onChange={(e) => setForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Cliente *</label>
                  <input className={inputCls} value={form.clientName} onChange={(e) => setForm(p => ({ ...p, clientName: e.target.value }))} required />
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
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Guardando...' : editCase ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
