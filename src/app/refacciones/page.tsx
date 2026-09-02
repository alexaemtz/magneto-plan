'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import AppShell from '@/components/AppShell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PartsOrder, PartsOrderStatus } from '@/types';
import {
  subscribeToPartsOrders,
  createPartsOrder,
  updatePartsOrder,
  deletePartsOrder,
} from '@/lib/firestore/refacciones';
import { todayISO, isoToDisplay, cn, normalizeName } from '@/lib/utils';
import { useSearch } from '@/context/SearchContext';
import { getCarModels } from '@/lib/firestore/catalog';
import { CarModel } from '@/types';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  Package,
  DollarSign,
  CircleCheck,
  Clock,
  Star,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, Card, StatCard, TableSkeleton } from '@/components/ui/primitives';

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<PartsOrderStatus, string> = {
  PENDIENTE:       'Pendiente',
  ENTREGADO:       'Entregado',
  PEDIDO_ESPECIAL: 'Pedido especial',
  CANCELADO:       'Cancelado',
};

const STATUS_COLORS: Record<PartsOrderStatus, string> = {
  PENDIENTE:       'bg-amber-100 text-amber-700 border border-amber-300',
  ENTREGADO:       'bg-emerald-100 text-emerald-700 border border-emerald-300',
  PEDIDO_ESPECIAL: 'bg-violet-100 text-violet-700 border border-violet-300',
  CANCELADO:       'bg-red-100 text-red-600 border border-red-300',
};

const STATUS_CHART_COLORS: Record<PartsOrderStatus, string> = {
  PENDIENTE:       '#f59e0b',
  ENTREGADO:       '#10b981',
  PEDIDO_ESPECIAL: '#8b5cf6',
  CANCELADO:       '#ef4444',
};

const ALL_STATUSES: PartsOrderStatus[] = ['PENDIENTE', 'ENTREGADO', 'PEDIDO_ESPECIAL', 'CANCELADO'];

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

// ── Column definitions ────────────────────────────────────────────────────────

type ColKey =
  | 'captureDate'
  | 'capturedBy'
  | 'requestedBy'
  | 'carModel'
  | 'vin'
  | 'clientName'
  | 'clientPhone'
  | 'invoice'
  | 'partNumber'
  | 'quantity'
  | 'description'
  | 'price'
  | 'location'
  | 'status';

const COLUMNS: { key: ColKey; label: string; defaultWidth: number }[] = [
  { key: 'captureDate',  label: 'Fecha captura', defaultWidth: 150 },
  { key: 'capturedBy',   label: 'Capturó',       defaultWidth: 140 },
  { key: 'requestedBy',  label: 'Solicitó',      defaultWidth: 140 },
  { key: 'carModel',     label: 'Modelo',        defaultWidth: 140 },
  { key: 'vin',          label: 'VIN',           defaultWidth: 165 },
  { key: 'clientName',   label: 'Cliente',       defaultWidth: 165 },
  { key: 'clientPhone',  label: 'Teléfono',      defaultWidth: 130 },
  { key: 'invoice',      label: 'Factura',       defaultWidth: 90  },
  { key: 'partNumber',   label: 'No. Parte',     defaultWidth: 140 },
  { key: 'quantity',     label: 'Cantidad',      defaultWidth: 130 },
  { key: 'description',  label: 'Descripción',   defaultWidth: 220 },
  { key: 'price',        label: 'Precio',        defaultWidth: 130 },
  { key: 'location',     label: 'Ubicación',     defaultWidth: 140 },
  { key: 'status',       label: 'Estado',        defaultWidth: 155 },
];

const ACTIONS_W = 96;

function getColValue(o: PartsOrder, key: ColKey): string {
  switch (key) {
    case 'captureDate':  return isoToDisplay(o.captureDate);
    case 'capturedBy':   return o.capturedBy ?? '';
    case 'requestedBy':  return o.requestedBy ?? '';
    case 'carModel':     return o.carModel ?? '';
    case 'vin':          return o.vin ?? '';
    case 'clientName':   return o.clientName ?? '';
    case 'clientPhone':  return o.clientPhone ?? '';
    case 'invoice':      return o.invoice ? 'Sí' : 'No';
    case 'partNumber':   return o.partNumber ?? '';
    case 'quantity':     return String(o.quantity ?? 0);
    case 'description':  return o.description ?? '';
    case 'price':        return MXN.format(o.price ?? 0);
    case 'location':     return o.location ?? '';
    case 'status':       return STATUS_LABELS[o.status] ?? o.status;
  }
}

// ── Item row type (used inside the form) ─────────────────────────────────────

type ItemRow = {
  partNumber:  string;
  quantity:    number;
  description: string;
  price:       number;
  location:    string;
  status:      PartsOrderStatus;
};

function defaultItem(): ItemRow {
  return { partNumber: '', quantity: 1, description: '', price: 0, location: '', status: 'PENDIENTE' };
}

// ── FilterDropdown with search ────────────────────────────────────────────────

type FilterAnchor = { col: ColKey; top: number; left: number };

function FilterDropdown({
  col,
  top,
  left,
  orders,
  active,
  onClose,
  onChange,
}: {
  col: ColKey;
  top: number;
  left: number;
  orders: PartsOrder[];
  active: Set<string>;
  onClose: () => void;
  onChange: (v: Set<string>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  const unique = useMemo(
    () => [...new Set(orders.map((o) => getColValue(o, col)))].sort(),
    [orders, col],
  );

  const visible = search.trim()
    ? unique.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : unique;

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
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999, ['--origin' as string]: 'top left' }}
      className="dropdown-card w-64 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 flex flex-col max-h-80"
    >
      <div className="flex items-center justify-between px-3.5 pb-2 border-b border-gray-100 mb-1.5 shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Filtrar</span>
        {active.size > 0 && (
          <button
            onClick={() => onChange(new Set())}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="px-3.5 pb-2 border-b border-gray-100 shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          autoFocus
          className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div className="overflow-y-auto flex-1">
        {visible.length === 0 ? (
          <p className="px-3.5 py-2 text-sm text-gray-400">Sin coincidencias</p>
        ) : (
          visible.map((v) => (
            <label
              key={v}
              className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 w-4 h-4"
                checked={active.has(v)}
                onChange={() => toggle(v)}
              />
              <span className="text-sm text-gray-700 truncate">{v || 'Sin valor'}</span>
            </label>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── SortIcon ─────────────────────────────────────────────────────────────────

function SortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: ColKey;
  sortCol: ColKey | null;
  sortDir: 'asc' | 'desc' | null;
}) {
  if (sortCol !== col) return <ChevronsUpDown size={13} className="text-gray-300 shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-blue-500 shrink-0" />
    : <ChevronDown size={13} className="text-blue-500 shrink-0" />;
}

// ── DonutChart ───────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 80, cy = 80, r = 55, sw = 28;
  const C = 2 * Math.PI * r;

  const visible = data.filter((d) => d.value > 0);
  const segments = visible.map((d, i) => {
    const fraction = d.value / total;
    const cumulative = visible.slice(0, i).reduce((s, x) => s + x.value / total, 0);
    const dash = fraction * C;
    const gap = (1 - fraction) * C;
    const offset = (1 - cumulative) * C;
    return { ...d, dash, gap, offset };
  });
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-4">
        <div className="w-24 h-24 rounded-full border-[14px] border-gray-100" />
        <span className="text-xs text-gray-300">Sin datos</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <svg viewBox="0 0 160 160" className="w-44 h-44">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={sw}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x="80" y="76" textAnchor="middle" fill="#111827" fontSize="22" fontWeight="700">
          {total}
        </text>
        <text x="80" y="93" textAnchor="middle" fill="#9CA3AF" fontSize="11">
          pedidos
        </text>
      </svg>
    </div>
  );
}

// ── OrderForm ─────────────────────────────────────────────────────────────────

function OrderForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: PartsOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;

  const [header, setHeader] = useState({
    captureDate: initial?.captureDate ?? todayISO(),
    capturedBy:  initial?.capturedBy  ?? '',
    requestedBy: initial?.requestedBy ?? '',
    carModel:    initial?.carModel    ?? '',
    vin:         initial?.vin         ?? '',
    clientName:  initial?.clientName  ?? '',
    clientPhone: initial?.clientPhone ?? '',
    invoice:     initial?.invoice     ?? false,
  });

  const [items, setItems] = useState<ItemRow[]>([
    isEdit
      ? {
          partNumber:  initial!.partNumber,
          quantity:    initial!.quantity,
          description: initial!.description,
          price:       initial!.price,
          location:    initial!.location,
          status:      initial!.status,
        }
      : defaultItem(),
  ]);

  const [saving, setSaving]       = useState(false);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    getCarModels(true)
      .catch(() => [] as CarModel[])
      .then(setCarModels)
      .finally(() => setModelsLoading(false));
  }, []);

  function setH<K extends keyof typeof header>(k: K, v: typeof header[K]) {
    setHeader((p) => ({ ...p, [k]: v }));
  }

  function setItem(i: number, k: keyof ItemRow, v: ItemRow[keyof ItemRow]) {
    setItems((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, defaultItem()]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!header.clientName.trim() || !header.carModel) {
      toast.error('Completa cliente y modelo (*)');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].partNumber.trim() || !items[i].description.trim()) {
        toast.error(`Completa No. Parte y Descripción en la fila ${i + 1}`);
        return;
      }
    }

    setSaving(true);
    try {
      const hdr = {
        captureDate: header.captureDate,
        capturedBy:  normalizeName(header.capturedBy),
        requestedBy: normalizeName(header.requestedBy),
        carModel:    header.carModel,
        vin:         header.vin.trim().toUpperCase(),
        clientName:  normalizeName(header.clientName),
        clientPhone: header.clientPhone.trim(),
        invoice:     header.invoice,
      };

      const toPayload = (item: ItemRow): Omit<PartsOrder, 'id'> => ({
        ...hdr,
        partNumber:  item.partNumber.trim().toUpperCase(),
        quantity:    item.quantity,
        description: item.description.trim(),
        price:       item.price,
        location:    normalizeName(item.location),
        status:      item.status,
      });

      if (isEdit && initial?.id) {
        await updatePartsOrder(initial.id, toPayload(items[0]));
        toast.success('Pedido actualizado');
      } else {
        await Promise.all(items.map((item) => createPartsOrder(toPayload(item))));
        toast.success(
          items.length === 1 ? 'Pedido creado' : `${items.length} piezas creadas`,
        );
      }
      onSaved();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSave();
  }

  const inp =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';
  const inpSm =
    'w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white';
  const lbl = 'block text-xs font-semibold text-gray-700 mb-1';

  return (
    <div className="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Editar pieza' : 'Nuevo pedido de refacciones'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Form body */}
        <form
          id="order-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >
          {/* ── Encabezado del pedido ── */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Datos del pedido
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Fecha de captura</label>
                <input
                  type="date"
                  className={inp}
                  value={header.captureDate}
                  onChange={(e) => setH('captureDate', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={lbl}>Cliente *</label>
                <input
                  className={inp}
                  placeholder="Nombre del cliente"
                  value={header.clientName}
                  onChange={(e) => setH('clientName', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={lbl}>Modelo *</label>
                <select
                  className={inp}
                  value={header.carModel}
                  onChange={(e) => setH('carModel', e.target.value)}
                  required
                >
                  <option value="">
                    {modelsLoading ? 'Cargando...' : 'Seleccionar modelo…'}
                  </option>
                  {carModels.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>VIN</label>
                <input
                  className={inp}
                  placeholder="LG..."
                  value={header.vin}
                  onChange={(e) => setH('vin', e.target.value)}
                />
              </div>
              <div>
                <label className={lbl}>Capturó</label>
                <input
                  className={inp}
                  placeholder="Nombre del capturista"
                  value={header.capturedBy}
                  onChange={(e) => setH('capturedBy', e.target.value)}
                />
              </div>
              <div>
                <label className={lbl}>Solicitó</label>
                <input
                  className={inp}
                  placeholder="Nombre de quien solicitó"
                  value={header.requestedBy}
                  onChange={(e) => setH('requestedBy', e.target.value)}
                />
              </div>
              <div>
                <label className={lbl}>Teléfono del cliente</label>
                <input
                  type="tel"
                  className={inp}
                  placeholder="664 000 0000"
                  value={header.clientPhone}
                  onChange={(e) => setH('clientPhone', e.target.value)}
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer select-none mt-4">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                    checked={header.invoice}
                    onChange={(e) => setH('invoice', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700">Requiere factura</span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Piezas ── */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              {isEdit ? 'Pieza' : `Piezas (${items.length})`}
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="table-fixed w-full min-w-[540px] border-collapse">
                <colgroup>
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '58px' }} />
                  <col />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '122px' }} />
                  {!isEdit && <col style={{ width: '32px' }} />}
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">No. Parte *</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Cant.</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Descripción *</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Precio</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Ubicación</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Estado</th>
                    {!isEdit && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-1.5 py-1.5">
                        <input
                          className={inpSm}
                          placeholder="10000245"
                          value={item.partNumber}
                          onChange={(e) => setItem(i, 'partNumber', e.target.value)}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className={inpSm}
                          value={item.quantity}
                          onChange={(e) => setItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          className={inpSm}
                          placeholder="Descripción"
                          value={item.description}
                          onChange={(e) => setItem(i, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={inpSm}
                          value={item.price}
                          onChange={(e) => setItem(i, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          className={inpSm}
                          placeholder="Almacén A"
                          value={item.location}
                          onChange={(e) => setItem(i, 'location', e.target.value)}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select
                          className={inpSm}
                          value={item.status}
                          onChange={(e) => setItem(i, 'status', e.target.value as PartsOrderStatus)}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      {!isEdit && (
                        <td className="px-1 py-1.5 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(i)}
                              className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isEdit && (
              <button
                type="button"
                onClick={addItem}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Plus size={13} />
                Agregar pieza
              </button>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="order-form"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {saving
              ? 'Guardando...'
              : isEdit
              ? 'Actualizar'
              : items.length === 1
              ? 'Crear pedido'
              : `Crear ${items.length} piezas`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RefaccionesPage() {
  const [orders, setOrders] = useState<PartsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Top filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<PartsOrderStatus>>(new Set());

  // Table state
  const [sortCol, setSortCol] = useState<ColKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(
    () => Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColKey, number>,
  );
  const [colFilters, setColFilters] = useState<Partial<Record<ColKey, Set<string>>>>({});
  const [openFilter, setOpenFilter] = useState<FilterAnchor | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const resizeRef = useRef<{ col: ColKey; startX: number; startW: number } | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<PartsOrder | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PartsOrder | null>(null);

  const { query } = useSearch();

  // ── Firestore subscription ────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToPartsOrders((data) => {
      setOrders(data);
      setLastUpdated(new Date());
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Column resize ────────────────────────────────────────────────────────

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const { col, startX, startW } = resizeRef.current;
      setColWidths((prev) => ({ ...prev, [col]: Math.max(60, startW + ev.clientX - startX) }));
    }
    function onUp() { resizeRef.current = null; }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
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

  // ── Filtered + sorted + paginated ────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...orders];

    if (dateFrom) result = result.filter((o) => o.captureDate >= dateFrom);
    if (dateTo)   result = result.filter((o) => o.captureDate <= dateTo);

    if (statusFilter.size > 0) result = result.filter((o) => statusFilter.has(o.status));

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((o) =>
        [o.clientName, o.clientPhone, o.carModel, o.vin, o.partNumber, o.description, o.location, o.capturedBy, o.requestedBy, STATUS_LABELS[o.status]]
          .some((v) => v?.toLowerCase().includes(q)),
      );
    }

    for (const [col, vals] of Object.entries(colFilters) as [ColKey, Set<string>][]) {
      if (vals.size > 0) result = result.filter((o) => vals.has(getColValue(o, col)));
    }

    if (sortCol && sortDir) {
      if (sortCol === 'price') {
        result.sort((a, b) =>
          sortDir === 'asc' ? (a.price ?? 0) - (b.price ?? 0) : (b.price ?? 0) - (a.price ?? 0),
        );
      } else if (sortCol === 'quantity') {
        result.sort((a, b) =>
          sortDir === 'asc' ? (a.quantity ?? 0) - (b.quantity ?? 0) : (b.quantity ?? 0) - (a.quantity ?? 0),
        );
      } else {
        result.sort((a, b) => {
          const av = getColValue(a, sortCol);
          const bv = getColValue(b, sortCol);
          return sortDir === 'asc' ? av.localeCompare(bv, 'es') : bv.localeCompare(av, 'es');
        });
      }
    }

    return result;
  }, [orders, dateFrom, dateTo, statusFilter, query, colFilters, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeFilterCount = Object.values(colFilters).filter((s) => s && s.size > 0).length;

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total      = filtered.length;
    const totalSales = filtered.reduce((s, o) => s + (o.price ?? 0) * (o.quantity ?? 1), 0);
    const cnt        = (s: PartsOrderStatus) => filtered.filter((o) => o.status === s).length;
    const pct        = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    const especialSales = filtered
      .filter((o) => o.status === 'PEDIDO_ESPECIAL')
      .reduce((s, o) => s + (o.price ?? 0) * (o.quantity ?? 1), 0);

    return {
      total,
      totalSales,
      entregados:    cnt('ENTREGADO'),
      entregadosPct: pct(cnt('ENTREGADO')),
      pendientes:    cnt('PENDIENTE'),
      pendientesPct: pct(cnt('PENDIENTE')),
      especial:      cnt('PEDIDO_ESPECIAL'),
      especialSales,
      especialPct:   totalSales > 0 ? Math.round((especialSales / totalSales) * 100) : 0,
      cancelados:    cnt('CANCELADO'),
      canceladosPct: pct(cnt('CANCELADO')),
    };
  }, [filtered]);

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(
    () =>
      ALL_STATUSES.map((s) => ({
        label: STATUS_LABELS[s],
        value: filtered.filter((o) => o.status === s).length,
        color: STATUS_CHART_COLORS[s],
      })),
    [filtered],
  );

  const topClients = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filtered.forEach((o) => {
      const prev = map.get(o.clientName) ?? { count: 0, total: 0 };
      map.set(o.clientName, {
        count: prev.count + 1,
        total: prev.total + (o.price ?? 0) * (o.quantity ?? 1),
      });
    });
    return [...map.entries()]
      .map(([name, { count, total }]) => ({ name, count, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filtered]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toggleStatus(s: PartsOrderStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  function handleDelete(order: PartsOrder) {
    setConfirmDelete(order);
  }

  async function handleDeleteConfirmed(order: PartsOrder) {
    setConfirmDelete(null);
    try {
      await deletePartsOrder(order.id!);
      toast.success('Pedido eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="px-6 py-7 space-y-6 max-w-screen-2xl mx-auto">

        {/* Header */}
        <PageHeader
          title="Refacciones"
          description={lastUpdatedStr ? `Última actualización: ${lastUpdatedStr}` : undefined}
        >
          <button
            onClick={() => { setEditOrder(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} />
            Nuevo pedido
          </button>
        </PageHeader>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-[0_1px_2px_rgba(17,24,39,0.04)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 shrink-0">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 shrink-0">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <X size={12} /> Limpiar fechas
            </button>
          )}

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">Estado:</span>
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                  statusFilter.has(s)
                    ? STATUS_COLORS[s]
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300',
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            {statusFilter.size > 0 && (
              <button
                onClick={() => setStatusFilter(new Set())}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <X size={12} /> Todos
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total pedidos" value={kpis.total} tone="accent" icon={<Package size={17} />} />
          <StatCard label="Total venta" value={MXN.format(kpis.totalSales)} valueClassName="text-lg" tone="success" icon={<DollarSign size={17} />} />
          <StatCard label="Entregados" value={kpis.entregados} sub={`${kpis.entregadosPct}% del total`} tone="success" icon={<CircleCheck size={17} />} />
          <StatCard label="Pendientes" value={kpis.pendientes} sub={`${kpis.pendientesPct}% del total`} tone="warning" icon={<Clock size={17} />} />
          <StatCard label="Pedido especial" value={kpis.especial} sub={`${kpis.especialPct}% de la venta`} tone="violet" icon={<Star size={17} />} />
          <StatCard label="Cancelados" value={kpis.cancelados} sub={`${kpis.canceladosPct}% del total`} tone="danger" icon={<XCircle size={17} />} />
        </div>

        {/* Table section */}
        <div className="space-y-2">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  <Filter size={11} />
                  {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
                  <button
                    onClick={() => setColFilters({})}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
              <span className="text-xs text-gray-400">
                {filtered.length > 0
                  ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} de ${filtered.length}`
                  : '0 registros'}
              </span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} className="text-gray-600" />
                </button>
                <span className="text-xs font-medium text-gray-600 px-2">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} className="text-gray-600" />
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={8} cols={8} />
              </div>
            ) : (
              <table
                className="table-fixed border-collapse w-full"
                style={{
                  minWidth: COLUMNS.reduce((s, c) => s + colWidths[c.key], 0) + ACTIONS_W,
                }}
              >
                <colgroup>
                  {COLUMNS.map((c) => (
                    <col key={c.key} style={{ width: colWidths[c.key] }} />
                  ))}
                  <col style={{ width: ACTIONS_W }} />
                </colgroup>

                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-200">
                    {COLUMNS.map((col) => {
                      const hasFilter = (colFilters[col.key]?.size ?? 0) > 0;
                      return (
                        <th
                          key={col.key}
                          className="relative select-none text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap border-r border-gray-200 last:border-r-0"
                        >
                          <div className="flex items-center gap-1.5 pr-5">
                            <button
                              className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                              onClick={() => handleSort(col.key)}
                            >
                              {col.label}
                              <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openFilter?.col === col.key) { setOpenFilter(null); return; }
                                const r = e.currentTarget.getBoundingClientRect();
                                const left = Math.min(r.left, window.innerWidth - 272);
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
                          {openFilter?.col === col.key && (
                            <FilterDropdown
                              col={col.key}
                              top={openFilter.top}
                              left={openFilter.left}
                              orders={orders}
                              active={colFilters[col.key] ?? new Set()}
                              onClose={() => setOpenFilter(null)}
                              onChange={(v) =>
                                setColFilters((prev) => ({ ...prev, [col.key]: v }))
                              }
                            />
                          )}
                          <div
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => startResize(col.key, e)}
                          />
                        </th>
                      );
                    })}
                    <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 text-center bg-gray-50/70">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={COLUMNS.length + 1}
                        className="py-14 text-center text-sm text-gray-400"
                      >
                        {orders.length === 0
                          ? 'No hay pedidos registrados'
                          : 'Sin resultados para los filtros aplicados'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-xs text-gray-600 border-r border-gray-100 whitespace-nowrap">
                          {isoToDisplay(order.captureDate)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-r border-gray-100 truncate">
                          {order.capturedBy}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-r border-gray-100 truncate">
                          {order.requestedBy}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-r border-gray-100 truncate">
                          {order.carModel}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-gray-600 border-r border-gray-100 truncate">
                          {order.vin}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-gray-800 border-r border-gray-100 truncate">
                          {order.clientName}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 border-r border-gray-100 whitespace-nowrap">
                          {order.clientPhone}
                        </td>
                        <td className="px-3 py-2.5 border-r border-gray-100 text-center">
                          {order.invoice
                            ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">Sí</span>
                            : <span className="text-gray-300">&nbsp;</span>
                          }
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-gray-600 border-r border-gray-100 truncate">
                          {order.partNumber}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 text-center border-r border-gray-100">
                          {order.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-r border-gray-100 truncate">
                          {order.description}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-800 border-r border-gray-100 whitespace-nowrap">
                          {MXN.format(order.price ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 border-r border-gray-100 truncate">
                          {order.location}
                        </td>
                        <td className="px-3 py-2.5 border-r border-gray-100">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap',
                              STATUS_COLORS[order.status],
                            )}
                          >
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setEditOrder(order); setShowForm(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(order)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-end">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} className="text-gray-600" />
                </button>
                <span className="text-xs font-medium text-gray-600 px-2">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} className="text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Donut chart */}
          <Card className="px-5 py-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Resumen por estado</h3>
            <div className="flex flex-col items-center gap-4">
              <DonutChart data={chartData} />
              <div className="w-full space-y-2">
                {chartData.map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-gray-600">{d.label}</span>
                    </div>
                    <span className="font-semibold text-gray-800 tabular">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Horizontal bar chart */}
          <Card className="px-5 py-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Pedidos por estado</h3>
            <div className="space-y-4">
              {chartData.map((d) => {
                const max = Math.max(...chartData.map((x) => x.value), 1);
                const pct = Math.round((d.value / max) * 100);
                return (
                  <div key={d.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">{d.label}</span>
                      <span className="text-xs font-semibold text-gray-800 tabular">{d.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full origin-left transform-gpu transition-transform duration-300 ease-out"
                        style={{ width: '100%', transform: `scaleX(${pct / 100})`, backgroundColor: d.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Clientes */}
          <Card className="px-5 py-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Top Clientes</h3>
            {topClients.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Sin datos</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {topClients.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3 py-2">
                    <span className="text-xs font-bold text-gray-300 w-5 text-right shrink-0 tabular">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {c.count} pedido{c.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 shrink-0 tabular">
                      {MXN.format(c.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showForm && (
        <OrderForm
          initial={editOrder ?? undefined}
          onClose={() => { setShowForm(false); setEditOrder(null); }}
          onSaved={() => { setShowForm(false); setEditOrder(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="¿Eliminar pedido?"
          message={`${confirmDelete.clientName} · ${confirmDelete.partNumber}`}
          detail={confirmDelete.description ? confirmDelete.description : undefined}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeleteConfirmed(confirmDelete)}
        />
      )}
    </AppShell>
  );
}
