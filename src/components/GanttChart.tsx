'use client';

import { useMemo, useState } from 'react';
import { Plus, X, Ban } from 'lucide-react';
import { Appointment, AppointmentStatus, Ramp, RampBlock } from '@/types';
import {
  generateTimeSlots,
  timeToMinutes,
  minutesToTime,
  rampBlockRangeForDate,
  SERVICE_COLORS_LIGHT,
  SERVICE_LABELS,
  cn,
} from '@/lib/utils';

const WASH_MIN = 45; // fixed duration for LAVADO blocks

interface GanttChartProps {
  appointments: Appointment[];
  date: string;
  rampBlocks?: RampBlock[];
  onSlotClick?: (ramp: Ramp | null, time: string) => void;
  onSelect?: (appt: Appointment) => void;
  onDelete?: (appt: Appointment) => void;
  onMove?: (appt: Appointment, targetRamp: Ramp | null, targetType: string, targetTime: string) => void;
  onDisableRamp?: (ramp: Ramp, time: string) => void;
  onSelectRampBlock?: (block: RampBlock) => void;
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
  RECIBIDO:            'bg-teal-500',
  PROGRAMADO:          'bg-gray-400',
  EN_PROCESO:          'bg-green-500',
  COMPLETADO:          'bg-blue-600',
  LAVADO:              'bg-sky-400',
  NO_SHOW:             'bg-red-500',
  ESPERANDO_REFACCION: 'bg-yellow-500',
  ENTREGADO:           'bg-emerald-500',
  CARRY_OVER:          'bg-purple-500',
};

const SLOT_WIDTH = 80; // px per 30-min slot
const ROW_HEIGHT = 56; // px

export default function GanttChart({
  appointments,
  date,
  rampBlocks = [],
  onSlotClick,
  onSelect,
  onDelete,
  onMove,
  onDisableRamp,
  onSelectRampBlock,
}: GanttChartProps) {
  const [tooltip, setTooltip]     = useState<{ appt: Appointment; x: number; y: number } | null>(null);
  const [dragAppt, setDragAppt]   = useState<Appointment | null>(null);
  const [dragOver, setDragOver]   = useState<{ rowLabel: string; slotTime: string } | null>(null);
  const [hoveredCell, setHovered] = useState<string | null>(null);
  const [menuCell, setMenuCell]   = useState<{ ramp: Ramp; time: string; x: number; y: number } | null>(null);

  const slots = useMemo(() => generateTimeSlots('07:00', '21:00', 30), []);

  // Route each appointment to its display row
  const byRamp = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    RAMPS.forEach((r) => map.set(r.label, []));

    appointments.forEach((a) => {
      if (a.status === 'NO_SHOW') {
        map.get('NO SHOW')!.push(a);
      } else if (a.status === 'LAVADO') {
        map.get('LAVADO')!.push(a);
      } else if (a.ramp) {
        // Use RAMPS array lookup so ALINEADOR (ramp 6) is correctly routed
        const row = RAMPS.find((r) => r.ramp === a.ramp);
        if (row) map.get(row.label)?.push(a);
      } else {
        map.get('SIN RAMPA')!.push(a);
      }
    });
    return map;
  }, [appointments]);

  // Find the appointment occupying a given slot in a given row
  function getOccupant(rowLabel: string, slotTime: string): Appointment | undefined {
    const appts = byRamp.get(rowLabel) ?? [];
    const slotMin = timeToMinutes(slotTime);

    if (rowLabel === 'LAVADO') {
      return appts.find((a) => {
        const start = timeToMinutes(a.lavadoStartTime ?? a.startTime);
        return slotMin >= start && slotMin < start + Math.ceil(WASH_MIN / 30) * 30;
      });
    }

    return appts.find((a) => {
      const start = timeToMinutes(a.startTime);
      const end   = timeToMinutes(a.endTime);
      return slotMin >= start && slotMin < end;
    });
  }

  // Number of 30-min slots spanned by a block (LAVADO rounds up to 2 full slots)
  function getSpan(a: Appointment, rowLabel: string): number {
    if (rowLabel === 'LAVADO') return Math.ceil(WASH_MIN / 30);
    const diff = timeToMinutes(a.endTime) - timeToMinutes(a.startTime);
    return Math.max(1, Math.ceil(diff / 30));
  }

  // Active rampBlock (if any) covering this ramp row on the displayed date
  function getBlockedRange(row: { ramp: Ramp | null; type: string }): { block: RampBlock; startTime: string; endTime: string } | null {
    if (row.type !== 'ramp' || row.ramp == null) return null;
    for (const b of rampBlocks) {
      if (b.ramp !== row.ramp) continue;
      const range = rampBlockRangeForDate(b, date);
      if (range) return { block: b, ...range };
    }
    return null;
  }

  const rendered    = new Set<string>();
  const totalWidth  = slots.length * SLOT_WIDTH + 112;

  return (
    <div className="w-full overflow-x-auto">
    <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm" style={{ width: 'fit-content' }}>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        {Object.entries(SERVICE_LABELS).map(([key, label]) => (
          <span
            key={key}
            className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', SERVICE_COLORS_LIGHT[key as keyof typeof SERVICE_COLORS_LIGHT])}
          >
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
          <div className="flex-1" />
        </div>

        {/* Rows */}
        {RAMPS.map((row) => {
          rendered.clear();
          const blockedRange = getBlockedRange(row);
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
                {slots.map((t) => {
                  const occupant = getOccupant(row.label, t);

                  if (occupant) {
                    // Already rendered by a previous slot (multi-slot span) — zero-width placeholder
                    if (rendered.has(occupant.id!)) {
                      return (
                        <div
                          key={t}
                          style={{ width: 0 }}
                          className="shrink-0"
                          onDragOver={(e) => { if (dragAppt && onMove) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragAppt && onMove) onMove(dragAppt, row.ramp, row.type, t);
                            setDragAppt(null);
                            setDragOver(null);
                          }}
                        />
                      );
                    }

                    rendered.add(occupant.id!);
                    const span       = getSpan(occupant, row.label);
                    const isDragging = dragAppt?.id === occupant.id;

                    return (
                      <div
                        key={t}
                        draggable={!!onMove}
                        style={{ width: SLOT_WIDTH * span, minWidth: SLOT_WIDTH * span, opacity: isDragging ? 0.4 : 1 }}
                        className={cn(
                          'shrink-0 relative rounded mx-0.5 my-1 px-1.5 py-1 border overflow-hidden',
                          'flex flex-col justify-center gap-0.5 transition-all hover:brightness-95',
                          onMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                          SERVICE_COLORS_LIGHT[occupant.serviceType],
                        )}
                        onDragStart={(e) => {
                          setDragAppt(occupant);
                          setTooltip(null);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', occupant.id ?? '');
                        }}
                        onDragEnd={() => { setDragAppt(null); setDragOver(null); }}
                        onClick={() => { if (!isDragging) onSelect?.(occupant); }}
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

                  // Rampa inhabilitada — cubre este slot y no hay cita ya agendada aquí
                  const isBlocked = blockedRange
                    && timeToMinutes(t) >= timeToMinutes(blockedRange.startTime)
                    && timeToMinutes(t) < timeToMinutes(blockedRange.endTime);

                  if (isBlocked) {
                    const isFirst = t === blockedRange!.startTime;
                    return (
                      <div
                        key={t}
                        style={{
                          width: SLOT_WIDTH,
                          minWidth: SLOT_WIDTH,
                          backgroundImage: 'repeating-linear-gradient(45deg, #e5e7eb, #e5e7eb 6px, #d1d5db 6px, #d1d5db 12px)',
                        }}
                        className="shrink-0 border-r border-gray-200 flex items-center justify-center cursor-pointer hover:brightness-95 transition-all"
                        onClick={() => onSelectRampBlock?.(blockedRange!.block)}
                        title="Rampa inhabilitada"
                      >
                        {isFirst && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-600 bg-white/85 px-1.5 py-0.5 rounded whitespace-nowrap">
                            <Ban size={10} /> Inhabilitada
                          </span>
                        )}
                      </div>
                    );
                  }

                  // Empty cell
                  const cellKey     = `${row.label}:${t}`;
                  const isDragTarget = dragOver?.rowLabel === row.label && dragOver?.slotTime === t;
                  const isHovered   = hoveredCell === cellKey;

                  return (
                    <div
                      key={t}
                      style={{ width: SLOT_WIDTH, minWidth: SLOT_WIDTH }}
                      className={cn(
                        'shrink-0 border-r relative transition-colors',
                        isDragTarget
                          ? 'bg-blue-100 border-blue-400'
                          : 'border-gray-100 hover:bg-blue-50/50',
                        onSlotClick && !dragAppt ? 'cursor-pointer' : '',
                      )}
                      onClick={(e) => {
                        if (dragAppt) return;
                        if (row.type === 'ramp' && row.ramp != null && onDisableRamp) {
                          setMenuCell({ ramp: row.ramp, time: t, x: e.clientX, y: e.clientY });
                        } else {
                          onSlotClick?.(row.ramp, t);
                        }
                      }}
                      onMouseEnter={() => { if (!dragAppt) setHovered(cellKey); }}
                      onMouseLeave={() => setHovered(null)}
                      onDragOver={(e) => {
                        if (!dragAppt || !onMove) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOver({ rowLabel: row.label, slotTime: t });
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragAppt && onMove) onMove(dragAppt, row.ramp, row.type, t);
                        setDragAppt(null);
                        setDragOver(null);
                      }}
                    >
                      {onSlotClick && !dragAppt && isHovered && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Plus size={10} className="text-blue-600" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && !dragAppt && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 max-w-xs space-y-0.5"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-bold">{tooltip.appt.carModel} — {SERVICE_LABELS[tooltip.appt.serviceType]}</p>
          <p>VIN: {tooltip.appt.serialNumber || '—'}</p>
          <p>Cliente: {tooltip.appt.clientName}</p>
          <p>Tel: {tooltip.appt.clientPhone}</p>
          <p>Asesor: {tooltip.appt.advisor}</p>
          {tooltip.appt.tecnico && <p>Técnico: {tooltip.appt.tecnico}</p>}
          <p>En proceso: {tooltip.appt.startTime} – {tooltip.appt.endTime}</p>
          {tooltip.appt.status === 'LAVADO' && tooltip.appt.lavadoStartTime && (
            <p className="text-sky-300">
              Lavado: {tooltip.appt.lavadoStartTime} – {minutesToTime(timeToMinutes(tooltip.appt.lavadoStartTime) + WASH_MIN)}
            </p>
          )}
          {tooltip.appt.km != null && <p>KM: {tooltip.appt.km.toLocaleString()}</p>}
          {tooltip.appt.campaña && <p className="text-amber-300 font-semibold">Campaña</p>}
        </div>
      )}

      {/* "+" menu: nueva cita vs. inhabilitar rampa */}
      {menuCell && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuCell(null)}>
          <div
            className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 py-1 w-48"
            style={{ left: menuCell.x, top: menuCell.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
              onClick={() => { onSlotClick?.(menuCell.ramp, menuCell.time); setMenuCell(null); }}
            >
              <Plus size={14} className="text-blue-600" /> Nueva cita
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
              onClick={() => { onDisableRamp?.(menuCell.ramp, menuCell.time); setMenuCell(null); }}
            >
              <Ban size={14} className="text-red-500" /> Inhabilitar rampa
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
