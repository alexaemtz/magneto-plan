import { Appointment, Ramp } from '@/types';
import { timeToMinutes, minutesToTime } from '@/lib/utils';

export function sameRamp(a: Ramp | null | undefined, b: Ramp | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
}

export function findConflict(existing: Appointment[], form: Partial<Appointment>, editingId?: string): Appointment | null {
  if (!form.ramp || !form.startTime || !form.endTime || !form.date) return null;
  for (const appt of existing) {
    if (appt.id === editingId) continue;
    if (appt.status === 'NO_SHOW') continue;
    if (appt.date !== form.date || !sameRamp(appt.ramp, form.ramp)) continue;
    if (form.startTime < appt.endTime && form.endTime > appt.startTime) return appt;
  }
  return null;
}

// Next available gap on the same ramp/date
export function findNextSlot(
  existing: Appointment[],
  form: Partial<Appointment>,
  editingId?: string,
): { startTime: string; endTime: string } | null {
  if (!form.ramp || !form.startTime || !form.endTime || !form.date) return null;
  const duration = timeToMinutes(form.endTime) - timeToMinutes(form.startTime);
  if (duration <= 0) return null;

  const rampAppts = existing
    .filter((a) => a.id !== editingId && a.date === form.date && a.status !== 'NO_SHOW' && sameRamp(a.ramp, form.ramp))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  let candidate = timeToMinutes(form.startTime);
  const dayEnd  = timeToMinutes('21:00');

  while (candidate + duration <= dayEnd) {
    const candidateEnd = candidate + duration;
    const conflict = rampAppts.find((a) => {
      const aStart = timeToMinutes(a.startTime);
      const aEnd   = timeToMinutes(a.endTime);
      return candidate < aEnd && candidateEnd > aStart;
    });
    if (!conflict) return { startTime: minutesToTime(candidate), endTime: minutesToTime(candidateEnd) };
    candidate = timeToMinutes(conflict.endTime);
  }
  return null;
}
