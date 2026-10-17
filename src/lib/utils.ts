import { ServiceType, Ramp, RampBlock } from '@/types';

export function generateTimeSlots(from = '07:00', to = '19:00', stepMin = 30): string[] {
  const slots: string[] = [];
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  let cur = fh * 60 + fm;
  const end = th * 60 + tm;
  while (cur <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    cur += stepMin;
  }
  return slots;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const SERVICE_LABELS: Record<ServiceType, string> = {
  SERVICIO:             'Servicio',
  GARANTIA:             'Garantía',
  DIAGNOSTICO:          'Diagnóstico',
  SERVICIO_DIAGNOSTICO: 'Servicio + Diagnóstico',
  SERVICIO_GARANTIA:    'Servicio + Garantía',
  ALINEACION_BALANCEO:  'Alineación y Balanceo',
  BALANCEO:             'Otros Servicios',
  GARANTIA_DIAGNOSTICO: 'Garantía + Diagnóstico',
  SIN_CITA:             'Sin Cita',
};

/** Rango horario (HH:MM–HH:MM) que un bloqueo de rampa cubre en una fecha dada, o null si esa fecha no cae dentro del bloqueo. */
export function rampBlockRangeForDate(block: RampBlock, date: string): { startTime: string; endTime: string } | null {
  if (date < block.startDate) return null;
  if (block.endDate && date > block.endDate) return null;
  const startTime = date === block.startDate ? block.startTime : '07:00';
  const endTime = block.endDate && date === block.endDate ? (block.endTime ?? '21:00') : '21:00';
  return { startTime, endTime };
}

export function formatRamp(ramp: Ramp | null): string {
  if (ramp === null) return 'Sin rampa';
  if (ramp === 6) return 'Alineador';
  return `Rampa ${ramp}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} de ${MONTH_NAMES[parseInt(m) - 1].toLowerCase()} de ${y}`;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Normalizes a proper-name string: trims edges, collapses internal spaces,
 * and capitalizes the first letter of each word (Unicode-safe).
 */
export function normalizeName(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}
