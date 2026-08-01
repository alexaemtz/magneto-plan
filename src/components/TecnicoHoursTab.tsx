'use client';

import { useMemo, useState } from 'react';
import { Appointment } from '@/types';
import { timeToMinutes, cn } from '@/lib/utils';
import { Sun, Moon, CalendarOff, Users } from 'lucide-react';

interface Props {
  appointments: Appointment[];
}

type Turno = 'matutino' | 'vespertino' | 'sinCita';

interface TecnicoStats {
  tecnico: string;
  matutino: number;
  vespertino: number;
  sinCita: number;
  total: number;
}

const ALL = '__ALL__';
const SIN_ASIGNAR = 'Sin asignar';

function getTurno(a: Appointment): Turno {
  if (a.serviceType === 'SIN_CITA') return 'sinCita';
  return timeToMinutes(a.startTime) < timeToMinutes('12:00') ? 'matutino' : 'vespertino';
}

function formatHours(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

export default function TecnicoHoursTab({ appointments }: Props) {
  const [selectedTecnico, setSelectedTecnico] = useState(ALL);
  const [hovered, setHovered] = useState<string | null>(null);

  const statsByTecnico = useMemo(() => {
    const map = new Map<string, TecnicoStats>();
    for (const a of appointments) {
      const name = a.tecnico?.trim() || SIN_ASIGNAR;
      if (!map.has(name)) {
        map.set(name, { tecnico: name, matutino: 0, vespertino: 0, sinCita: 0, total: 0 });
      }
      const stats = map.get(name)!;
      const hours = a.workHours ?? 0;
      const turno = getTurno(a);
      stats[turno] += hours;
      stats.total += hours;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [appointments]);

  const grandTotal = statsByTecnico.reduce((sum, s) => sum + s.total, 0);
  const maxTotal = Math.max(...statsByTecnico.map((s) => s.total), 1);

  const cardsData = useMemo(() => {
    if (selectedTecnico === ALL) {
      return statsByTecnico.reduce(
        (acc, s) => ({
          matutino: acc.matutino + s.matutino,
          vespertino: acc.vespertino + s.vespertino,
          sinCita: acc.sinCita + s.sinCita,
        }),
        { matutino: 0, vespertino: 0, sinCita: 0 },
      );
    }
    const s = statsByTecnico.find((s) => s.tecnico === selectedTecnico);
    return { matutino: s?.matutino ?? 0, vespertino: s?.vespertino ?? 0, sinCita: s?.sinCita ?? 0 };
  }, [selectedTecnico, statsByTecnico]);

  const cards = [
    { key: 'matutino', label: 'Turno Matutino', sub: '7:00 – 12:00', value: cardsData.matutino, icon: Sun, color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'vespertino', label: 'Turno Vespertino', sub: '12:00 – 21:00', value: cardsData.vespertino, icon: Moon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'sinCita', label: 'Sin Cita', sub: 'Todo el día', value: cardsData.sinCita, icon: CalendarOff, color: 'text-rose-600', bg: 'bg-rose-50' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Filtro por técnico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Users size={15} className="text-gray-400" />
          Técnico
        </div>
        <select
          value={selectedTecnico}
          onChange={(e) => setSelectedTecnico(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        >
          <option value={ALL}>Todos (vista general)</option>
          {statsByTecnico.map((s) => (
            <option key={s.tecnico} value={s.tecnico}>{s.tecnico}</option>
          ))}
        </select>
        {selectedTecnico !== ALL && (
          <button
            onClick={() => setSelectedTecnico(ALL)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Cards de horas por turno */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                <div className={cn('p-1.5 rounded-lg', c.bg)}>
                  <Icon size={14} className={c.color} />
                </div>
              </div>
              <p className={cn('text-3xl font-bold mt-1', c.color)}>{formatHours(c.value)} h</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Gráfica de barras: total de horas por técnico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Total de horas por técnico</h3>

        {statsByTecnico.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            No hay servicios completados para este día
          </div>
        ) : (
          <div className="space-y-5">
            {statsByTecnico.map((s) => {
              const pct = Math.round((s.total / maxTotal) * 100);
              const pctOfGrandTotal = grandTotal > 0 ? Math.round((s.total / grandTotal) * 100) : 0;
              const isSelected = selectedTecnico === s.tecnico;
              const isHovered = hovered === s.tecnico;

              return (
                <div
                  key={s.tecnico}
                  className="relative"
                  onMouseEnter={() => setHovered(s.tecnico)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={cn('text-xs font-medium', isSelected ? 'text-blue-700' : 'text-gray-600')}>
                      {s.tecnico}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{formatHours(s.total)} h</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className={cn(
                        'h-4 rounded-full transition-all duration-300',
                        isSelected ? 'bg-blue-600' : 'bg-blue-400',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {isHovered && (
                    <div className="absolute z-10 -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none">
                      <p className="font-semibold">{s.tecnico}</p>
                      <p>Total: {formatHours(s.total)} h</p>
                      <p>{pctOfGrandTotal}% del total general</p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
