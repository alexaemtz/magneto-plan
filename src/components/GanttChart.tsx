'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Appointment, AppointmentStatus, Ramp } from '@/types';
import {
  generateTimeSlots,
  timeToMinutes,
  SERVICE_COLORS_LIGHT,
  SERVICE_LABELS,
  cn,
} from '@/lib/utils';

interface GanttChartProps {
  appointments: Appointment[];
  date: string;
  onSlotClick?: (ramp: Ramp | null, time: string) => void;
  onSelect?: (appt: Appointment) => void;
  onDelete?: (appt: Appointment) => void;
}

const RAMPS: { label: string; ramp: Ramp | null; type: string }[] = [
  { label: 'RAMPA 1',   ramp: 1,    type: 'ramp'    },
  { label: 'RAMPA 2',   ramp: 2,    type: 'ramp'    },
  { label: 'RAMPA 3',   ramp: 3,    type: 'ramp'    },
  { label: 'RAMPA 4',   ramp: 4,    type: 'ramp'    },
  { label: 'RAMPA 5',   ramp: 5,    type: 'ramp'    },
  { label: 'ALINEADOR', ramp: 6,    type: 'ramp'    },
  { label: 'SIN RAMPA', ramp: null, type: 'no_ramp' },
  { label: 'NO SHOW',   ramp: null, type: 'no_show' },
  { label: 'LAVADO',    ramp: null, type: 'wash'    },
];

const STATUS_DOT: Record<AppointmentStatus, string> = {
  PROGRAMADO:          'bg-gray-400',
  EN_PROCESO:          'bg-green-500',
  COMPLETADO:          'bg-blue-600',
  LAVADO:              'bg-sky-400',
  NO_SHOW:             'bg-red-500',
  ESPERANDO_REFACCION: 'bg-yellow-500',
};

const SLOT_WIDTH = 80; // px per 30-min slot
const ROW_HEIGHT = 56; // px

export default function GanttChart({ appointments, date, onSlotClick, onSelect, onDelete }: GanttChartProps) {
  const [tooltip, setTooltip] = useState<{ appt: Appointment; x: number; y: number } | null>(null);

  const slots = useMemo(() => generateTimeSlots('07:00', '19:00', 30), []);

  // Build a lookup: ramp -> list of appointments (sorted by startTime)
  const byRamp = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    RAMPS.forEach((r) => map.set(r.label, []));

    appointments.forEach((a) => {
      if (a.status === 'NO_SHOW') {
        map.get('NO SHOW')!.push(a);
      } else if (a.ramp) {
        map.get(`RAMPA ${a.ramp}`)!.push(a);
      } else {
        map.get('SIN RAMPA')!.push(a);
      }
    });
    return map;
  }, [appointments]);

  // For a given row and slot, find the appointment that occupies it
  function getOccupant(rowLabel: string, slotTime: string): Appointment | undefined {
    const appts = byRamp.get(rowLabel) ?? [];
    const slotMin = timeToMinutes(slotTime);
    return appts.find((a) => {
      const start = timeToMinutes(a.startTime);
      const end = timeToMinutes(a.endTime);
      return slotMin >= start && slotMin < end;
    });
  }

  // Calculate span (number of 30-min slots) for an appointment
  function getSpan(a: Appointment): number {
    const diff = timeToMinutes(a.endTime) - timeToMinutes(a.startTime);
    return Math.max(1, Math.ceil(diff / 30));
  }

  // Track which appointments have already been rendered to avoid duplicates
  const rendered = new Set<string>();

  const totalWidth = slots.length * SLOT_WIDTH + 120;

  return (
    <div className="relative overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        {Object.entries(SERVICE_LABELS).map(([key, label]) => (
          <span key={key} className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', SERVICE_COLORS_LIGHT[key as keyof typeof SERVICE_COLORS_LIGHT])}>
            {label}
          </span>
        ))}
      </div>

      <div style={{ minWidth: totalWidth }} className="relative">
        {/* Header: time slots */}
        <div className="flex sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="w-28 shrink-0 bg-gray-50 border-r border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3">
            Rampa
          </div>
          {slots.map((t) => (
            <div
              key={t}
              style={{ width: SLOT_WIDTH, minWidth: SLOT_WIDTH }}
              className="text-center text-xs font-medium text-gray-500 py-3 border-r border-gray-100 shrink-0"
            >
              {t}
            </div>
          ))}
        </div>

        {/* Rows */}
        {RAMPS.map((row) => {
          rendered.clear();
          return (
            <div
              key={row.label}
              className={cn(
                'flex border-b border-gray-100 group',
                row.type === 'no_ramp' && 'bg-amber-50/40',
                row.type === 'no_show' && 'bg-red-50/40',
                row.type === 'wash'    && 'bg-sky-50/40',
              )}
              style={{ height: ROW_HEIGHT }}
            >
              {/* Row label */}
              <div className={cn(
                'w-28 shrink-0 border-r border-gray-200 flex items-center justify-center text-xs font-bold text-gray-700 uppercase tracking-wide px-1',
                row.type === 'ramp'    && 'bg-gray-50',
                row.type === 'no_ramp' && 'bg-amber-100 text-amber-700',
                row.type === 'no_show' && 'bg-red-100 text-red-700',
                row.type === 'wash'    && 'bg-sky-100 text-sky-700',
              )}>
                {row.label}
              </div>

              {/* Cells */}
              <div className="relative flex flex-1">
                {slots.map((t, i) => {
                  const occupant = getOccupant(row.label, t);

                  if (occupant) {
                    if (rendered.has(occupant.id!)) {
                      // Zero-width — the rendered block already covers this slot visually.
                      // A non-zero width here would misalign everything to the right.
                      return <div key={t} style={{ width: 0 }} className="shrink-0" />;
                    }
                    rendered.add(occupant.id!);
                    const span = getSpan(occupant);
                    return (
                      <div
                        key={t}
                        style={{ width: SLOT_WIDTH * span, minWidth: SLOT_WIDTH * span }}
                        className={cn(
                          'group shrink-0 relative border-r border-white cursor-pointer rounded mx-0.5 my-1 px-1.5 py-1 border overflow-hidden flex flex-col justify-center gap-0.5 hover:brightness-95 transition-all',
                          SERVICE_COLORS_LIGHT[occupant.serviceType]
                        )}
                        onClick={() => onSelect?.(occupant)}
                        onMouseEnter={(e) => setTooltip({ appt: occupant, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {onDelete && (
                          <button
                            className="absolute top-0.5 right-0.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded bg-black/15 hover:bg-red-500 hover:text-white text-current"
                            onClick={(e) => { e.stopPropagation(); onDelete(occupant); }}
                            title="Eliminar cita"
                          >
                            <X size={10} strokeWidth={2.5} />
                          </button>
                        )}
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[occupant.status])} />
                          <span className="text-xs font-semibold truncate">{occupant.carModel}</span>
                        </div>
                        {span > 1 && (
                          <span className="text-xs truncate opacity-80">{occupant.serialNumber}</span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={t}
                      style={{ width: SLOT_WIDTH, minWidth: SLOT_WIDTH }}
                      className="shrink-0 border-r border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors"
                      onClick={() => onSlotClick?.(row.ramp, t)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-bold">{tooltip.appt.carModel} — {SERVICE_LABELS[tooltip.appt.serviceType]}</p>
          <p>VIN: {tooltip.appt.serialNumber || '—'}</p>
          <p>Cliente: {tooltip.appt.clientName}</p>
          <p>Tel: {tooltip.appt.clientPhone}</p>
          <p>Asesor: {tooltip.appt.advisor}</p>
          <p>Horario: {tooltip.appt.startTime} – {tooltip.appt.endTime}</p>
          {tooltip.appt.km && <p>KM: {tooltip.appt.km.toLocaleString()}</p>}
        </div>
      )}
    </div>
  );
}
