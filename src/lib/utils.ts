import { ServiceType, Ramp } from '@/types';

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
  BALANCEO:             'Balanceo',
  GARANTIA_DIAGNOSTICO: 'Garantía + Diagnóstico',
  SIN_CITA:             'Sin Cita',
};

export const SERVICE_COLORS: Record<ServiceType, string> = {
  SERVICIO:             'bg-green-500',
  GARANTIA:             'bg-purple-500',
  DIAGNOSTICO:          'bg-yellow-500',
  SERVICIO_DIAGNOSTICO: 'bg-teal-500',
  SERVICIO_GARANTIA:    'bg-orange-500',
  ALINEACION_BALANCEO:  'bg-indigo-500',
  BALANCEO:             'bg-indigo-400',
  GARANTIA_DIAGNOSTICO: 'bg-violet-500',
  SIN_CITA:             'bg-rose-500',
};

export const SERVICE_COLORS_LIGHT: Record<ServiceType, string> = {
  SERVICIO:             'bg-green-100 border-green-400 text-green-900',
  GARANTIA:             'bg-purple-100 border-purple-400 text-purple-900',
  DIAGNOSTICO:          'bg-yellow-100 border-yellow-400 text-yellow-900',
  SERVICIO_DIAGNOSTICO: 'bg-teal-100 border-teal-400 text-teal-900',
  SERVICIO_GARANTIA:    'bg-orange-100 border-orange-400 text-orange-900',
  ALINEACION_BALANCEO:  'bg-indigo-100 border-indigo-400 text-indigo-900',
  BALANCEO:             'bg-indigo-50 border-indigo-300 text-indigo-800',
  GARANTIA_DIAGNOSTICO: 'bg-violet-100 border-violet-400 text-violet-900',
  SIN_CITA:             'bg-rose-100 border-rose-400 text-rose-900',
};

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
