'use client';

import { useState } from 'react';
import { DailyIndicator } from '@/types';
import { upsertDailyIndicator } from '@/lib/firestore/indicators';
import toast from 'react-hot-toast';

type RowKey = 'citadosServicio' | 'citadosServicioPlusOne' | 'citadosReparacion' | 'citadosRevision' | 'sinCita';

export interface AccumulatedValues {
  rows: Record<RowKey, number>; // suma acumulada de "hoy" por concepto
  totalDia: number;             // suma acumulada de totales diarios
  ingresos: number;             // suma acumulada de ingresos del día
}

interface Props {
  indicator: DailyIndicator;
  readOnly?: boolean;
  onSave?: (updated: DailyIndicator) => void;
  // Si se pasa, muestra columna "Acumulado" de solo lectura
  accumulated?: AccumulatedValues | null;
}

const ROW_LABELS: Record<RowKey, string> = {
  citadosServicio:      'Citados Servicio',
  citadosServicioPlusOne: 'Citados Servicio +1',
  citadosReparacion:    'Citados Reparación',
  citadosRevision:      'Citados Revisión',
  sinCita:              'Sin cita',
};

const ROWS: RowKey[] = [
  'citadosServicio',
  'citadosServicioPlusOne',
  'citadosReparacion',
  'citadosRevision',
  'sinCita',
];

export default function DailyIndicatorTable({ indicator, readOnly = false, onSave, accumulated }: Props) {
  const [data, setData] = useState<DailyIndicator>(indicator);
  const [saving, setSaving] = useState(false);

  const showAccumulado = accumulated != null;

  function handleChange(row: RowKey, col: 'hoy' | 'realizado', value: string) {
    const num = parseInt(value) || 0;
    setData((prev) => ({ ...prev, [row]: { ...prev[row], [col]: num } }));
  }

  function computedTotalHoy(): number {
    return ROWS.reduce((sum, key) => sum + (data[key]?.hoy ?? 0), 0);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const toSave = { ...data, totalDia: computedTotalHoy() };
      await upsertDailyIndicator(toSave);
      setData(toSave);
      onSave?.(toSave);
      toast.success('Indicador guardado');
    } catch {
      toast.error('Error al guardar indicador');
    } finally {
      setSaving(false);
    }
  }

  const cellCls = 'border border-gray-200 px-3 py-2 text-center text-sm';
  const inputCls = 'w-16 text-center rounded border border-gray-300 bg-white text-gray-900 px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1a2e] text-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-60">POSTVENTA BYD HERMOSILLO</p>
        <p className="text-sm font-bold mt-0.5">{data.date}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-2.5 text-left font-semibold text-gray-700 min-w-44">
                Conceptos
              </th>
              <th className="border border-gray-200 px-4 py-2.5 font-semibold text-blue-700 w-24">
                Hoy
              </th>
              <th className="border border-gray-200 px-4 py-2.5 font-semibold text-green-700 w-24">
                Realizado
              </th>
              {showAccumulado && (
                <th className="border border-gray-200 px-4 py-2.5 font-semibold text-purple-700 w-28">
                  Acumulado
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Service rows */}
            {ROWS.map((key) => (
              <tr key={key} className="hover:bg-gray-50/50">
                <td className="border border-gray-200 px-4 py-2 font-medium text-gray-700">
                  {ROW_LABELS[key]}
                </td>

                {/* Hoy */}
                <td className={cellCls}>
                  {readOnly
                    ? <span className="font-semibold text-gray-800">{data[key]?.hoy ?? 0}</span>
                    : <input type="number" min={0} className={inputCls}
                        value={data[key]?.hoy ?? 0}
                        onChange={(e) => handleChange(key, 'hoy', e.target.value)} />
                  }
                </td>

                {/* Realizado */}
                <td className={cellCls}>
                  {readOnly
                    ? <span className="font-semibold text-gray-800">{data[key]?.realizado ?? 0}</span>
                    : <input type="number" min={0} className={inputCls}
                        value={data[key]?.realizado ?? 0}
                        onChange={(e) => handleChange(key, 'realizado', e.target.value)} />
                  }
                </td>

                {/* Acumulado — solo lectura, calculado externamente */}
                {showAccumulado && (
                  <td className={cellCls}>
                    <span className="font-bold text-purple-700">{accumulated!.rows[key] ?? 0}</span>
                  </td>
                )}
              </tr>
            ))}

            {/* Total de día */}
            <tr className="bg-gray-50">
              <td className="border border-gray-200 px-4 py-2 font-semibold text-gray-800">
                Total de día
              </td>
              <td className={cellCls}>
                <span className="font-bold text-blue-700 text-base">{computedTotalHoy()}</span>
              </td>
              <td className={cellCls} />
              {showAccumulado && (
                <td className={cellCls}>
                  <span className="font-bold text-purple-700 text-base">{accumulated!.totalDia}</span>
                </td>
              )}
            </tr>

            {/* Ingresos del día */}
            <tr className="bg-[#1a1a2e] text-white">
              <td className="border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300">
                Ingresos del día
              </td>
              <td className="border border-gray-700 px-3 py-2.5 text-center">
                {readOnly
                  ? <span className="font-bold text-yellow-300 text-lg">{data.ingresosTotal ?? 0}</span>
                  : <input type="number" min={0}
                      value={data.ingresosTotal ?? 0}
                      onChange={(e) => setData((p) => ({ ...p, ingresosTotal: parseInt(e.target.value) || 0 }))}
                      className="w-24 text-center rounded border border-gray-600 bg-gray-800 text-yellow-300 font-bold px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                }
              </td>
              <td className="border border-gray-700 px-4 py-2.5" />
              {showAccumulado && (
                <td className="border border-gray-700 px-3 py-2.5 text-center">
                  <span className="font-bold text-yellow-300 text-lg">{accumulated!.ingresos}</span>
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar indicador'}
          </button>
        </div>
      )}
    </div>
  );
}
