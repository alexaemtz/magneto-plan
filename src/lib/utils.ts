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

export const SERVICE_COLORS: Record<ServiceType, string> = {
  SERVICIO:             'bg-green-500',
  GARANTIA:             'bg-purple-500',
  DIAGNOSTICO:          'bg-yellow-500',
  SERVICIO_DIAGNOSTICO: 'bg-blue-500',
  SERVICIO_GARANTIA:    'bg-blue-500',
  ALINEACION_BALANCEO:  'bg-indigo-500',
  BALANCEO:             'bg-indigo-400',
  GARANTIA_DIAGNOSTICO: 'bg-violet-500',
  SIN_CITA:             'bg-rose-500',
};

export const SERVICE_COLORS_LIGHT: Record<ServiceType, string> = {
  SERVICIO:             'bg-green-50 border-green-300 text-green-700',
  GARANTIA:             'bg-purple-50 border-purple-300 text-purple-700',
  DIAGNOSTICO:          'bg-yellow-50 border-yellow-300 text-yellow-700',
  SERVICIO_DIAGNOSTICO: 'bg-blue-50 border-blue-300 text-blue-700',
  SERVICIO_GARANTIA:    'bg-blue-50 border-blue-300 text-blue-700',
  ALINEACION_BALANCEO:  'bg-indigo-50 border-indigo-300 text-indigo-700',
  BALANCEO:             'bg-indigo-50 border-indigo-300 text-indigo-600',
  GARANTIA_DIAGNOSTICO: 'bg-violet-50 border-violet-300 text-violet-700',
  SIN_CITA:             'bg-rose-50 border-rose-300 text-rose-700',
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
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${parseInt(d)} de ${months[parseInt(m) - 1]} de ${y}`;
}

export function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Normalizes a proper-name string: trims edges, collapses internal spaces,
 * and capitalizes the first letter of each word.
 */
export function normalizeName(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
