'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import DailyIndicatorTable, { AccumulatedValues } from '@/components/DailyIndicator';
import { DailyIndicator } from '@/types';
import { getIndicatorsByMonth, upsertDailyIndicator } from '@/lib/firestore/indicators';
import { todayISO } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

type RowKey = 'citadosServicio' | 'citadosServicioPlusOne' | 'citadosReparacion' | 'citadosRevision' | 'sinCita';
const ROW_KEYS: RowKey[] = ['citadosServicio', 'citadosServicioPlusOne', 'citadosReparacion', 'citadosRevision', 'sinCita'];

function makeEmpty(date: string): DailyIndicator {
  return {
    date,
    citadosServicio:      { hoy: 0, realizado: 0, acumulado: 0 },
    citadosServicioPlusOne: { hoy: 0, realizado: 0, acumulado: 0 },
    citadosReparacion:    { hoy: 0, realizado: 0, acumulado: 0 },
    citadosRevision:      { hoy: 0, realizado: 0, acumulado: 0 },
    sinCita:              { hoy: 0, realizado: 0, acumulado: 0 },
    totalDia: 0,
    ingresosTotal: 0,
  };
}

// Running sum por día, requiere indicadores ordenados ascendente
function computeRunningTotals(indicators: DailyIndicator[]): AccumulatedValues[] {
  const running: Record<string, number> = {};
  let runningTotalDia = 0;
  let runningIngresos = 0;

  return indicators.map((ind) => {
    for (const key of ROW_KEYS) {
      running[key] = (running[key] ?? 0) + (ind[key]?.hoy ?? 0);
    }
    const todayTotal = ROW_KEYS.reduce((sum, k) => sum + (ind[k]?.hoy ?? 0), 0);
    runningTotalDia += todayTotal;
    runningIngresos += ind.ingresosTotal ?? 0;

    return {
      rows: { ...running } as Record<RowKey, number>,
      totalDia: runningTotalDia,
      ingresos: runningIngresos,
    };
  });
}

export default function IndicadorPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;

  // eslint-disable-next-line no-unreachable
  const today = todayISO();
  const [year, setYear]   = useState(parseInt(today.split('-')[0]));
  const [month, setMonth] = useState(parseInt(today.split('-')[1]));
  const [indicators, setIndicators] = useState<DailyIndicator[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [newDate, setNewDate]       = useState(today);

  async function load() {
    setLoading(true);
    try {
      const data = await getIndicatorsByMonth(year, month);
      setIndicators(data);
    } catch (err) {
      console.error('Error cargando indicadores:', err);
      toast.error('Error al cargar los indicadores. Verifica los permisos de Firestore.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [year, month]);

  function shiftMonth(n: number) {
    let m = month + n;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m);
    setYear(y);
  }

  async function handleAdd() {
    if (!newDate) return;
    if (indicators.find((i) => i.date === newDate)) {
      toast.error('Ya existe un indicador para esa fecha');
      return;
    }
    await upsertDailyIndicator(makeEmpty(newDate));
    toast.success('Indicador creado');
    setAdding(false);
    load();
  }

  // Acumulados calculados en el cliente — se recalculan cada vez que cambia `indicators`
  const accumulatedByDay = computeRunningTotals(indicators);

  // Resumen del mes = último valor acumulado (o ceros si no hay días)
  const monthSummary = accumulatedByDay.at(-1) ?? { rows: {} as Record<RowKey, number>, totalDia: 0, ingresos: 0 };

  return (
    <AppShell>
      <div className="px-6 py-6 space-y-6 max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Indicador Diario</h1>
            <p className="text-sm text-gray-500 mt-0.5">Historial mensual — acumulado calculado automáticamente</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-1.5">
              <button onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-gray-100 transition-colors">
                <ChevronLeft size={18} className="text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2 min-w-36 text-center">
                {MONTHS[month - 1]} {year}
              </span>
              <button onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-gray-100 transition-colors">
                <ChevronRight size={18} className="text-gray-600" />
              </button>
            </div>

            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              <Plus size={16} />
              Agregar día
            </button>
          </div>
        </div>

        {/* Resumen del mes (totales acumulados hasta el último día registrado) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Servicios (mes)',    value: monthSummary.rows['citadosServicio'] ?? 0,   color: 'text-blue-600' },
            { label: 'Reparaciones (mes)', value: monthSummary.rows['citadosReparacion'] ?? 0, color: 'text-purple-600' },
            { label: 'Sin cita (mes)',     value: monthSummary.rows['sinCita'] ?? 0,            color: 'text-rose-600' },
            { label: 'Ingresos acumulados', value: monthSummary.ingresos,                       color: 'text-green-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Formulario agregar día */}
        {adding && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-2 pt-4">
              <button onClick={handleAdd}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                Crear
              </button>
              <button onClick={() => setAdding(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de indicadores */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : indicators.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
            No hay indicadores para {MONTHS[month - 1]} {year}
          </div>
        ) : (
          <div className="space-y-6">
            {indicators.map((ind, i) => (
              <DailyIndicatorTable
                key={ind.date}
                indicator={ind}
                accumulated={accumulatedByDay[i]}
                onSave={(updated) => {
                  setIndicators((prev) => prev.map((x) => x.date === updated.date ? updated : x));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
