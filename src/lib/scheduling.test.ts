import { describe, it, expect } from 'vitest';
import { sameRamp, findConflict, findNextSlot } from './scheduling';
import { Appointment } from '@/types';

function makeAppt(overrides: Partial<Appointment>): Appointment {
  return {
    date: '2026-08-10',
    serviceType: 'SERVICIO',
    carModel: 'BYD Shark',
    serialNumber: 'VIN123',
    appByd: false,
    invoice: false,
    clientName: 'Cliente',
    clientPhone: '5550000000',
    workHours: 1,
    workOrder: 'WO-1',
    ramp: 1,
    advisor: 'Asesor',
    startTime: '08:00',
    endTime: '09:00',
    status: 'PROGRAMADO',
    ...overrides,
  };
}

describe('sameRamp', () => {
  it('treats null and undefined as the same ramp', () => {
    expect(sameRamp(null, undefined)).toBe(true);
    expect(sameRamp(undefined, undefined)).toBe(true);
  });

  it('treats a set ramp vs. no ramp as different', () => {
    expect(sameRamp(1, null)).toBe(false);
    expect(sameRamp(null, 1)).toBe(false);
  });

  it('compares ramp numbers regardless of type coercion', () => {
    expect(sameRamp(1, 1)).toBe(true);
    expect(sameRamp(1, 2)).toBe(false);
  });
});

describe('findConflict', () => {
  it('returns null when the ramp/time is free', () => {
    const existing = [makeAppt({ id: 'a', ramp: 2, startTime: '08:00', endTime: '09:00' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findConflict(existing, form)).toBeNull();
  });

  it('detects an overlapping appointment on the same ramp/date', () => {
    const conflictAppt = makeAppt({ id: 'a', ramp: 1, startTime: '08:00', endTime: '09:00' });
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:30', endTime: '09:30' };
    expect(findConflict([conflictAppt], form)).toBe(conflictAppt);
  });

  it('does not flag back-to-back appointments (end === start) as a conflict', () => {
    const existing = [makeAppt({ id: 'a', ramp: 1, startTime: '08:00', endTime: '09:00' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '09:00', endTime: '10:00' };
    expect(findConflict(existing, form)).toBeNull();
  });

  it('ignores NO_SHOW appointments when checking for conflicts', () => {
    const existing = [makeAppt({ id: 'a', ramp: 1, startTime: '08:00', endTime: '09:00', status: 'NO_SHOW' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findConflict(existing, form)).toBeNull();
  });

  it('ignores the appointment being edited', () => {
    const existing = [makeAppt({ id: 'a', ramp: 1, startTime: '08:00', endTime: '09:00' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findConflict(existing, form, 'a')).toBeNull();
  });

  it('ignores appointments on a different date even on the same ramp', () => {
    const existing = [makeAppt({ id: 'a', ramp: 1, date: '2026-08-11', startTime: '08:00', endTime: '09:00' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findConflict(existing, form)).toBeNull();
  });
});

describe('findNextSlot', () => {
  it('returns null when required fields are missing', () => {
    expect(findNextSlot([], { ramp: 1 as const, date: '2026-08-10', startTime: '08:00' })).toBeNull();
  });

  it('returns the requested slot unchanged when the ramp is free', () => {
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findNextSlot([], form)).toEqual({ startTime: '08:00', endTime: '09:00' });
  });

  it('shifts to right after a conflicting appointment ends', () => {
    const existing = [makeAppt({ id: 'a', ramp: 1, startTime: '08:00', endTime: '09:00' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findNextSlot(existing, form)).toEqual({ startTime: '09:00', endTime: '10:00' });
  });

  it('skips over multiple back-to-back appointments to find the first real gap', () => {
    const existing = [
      makeAppt({ id: 'a', ramp: 1, startTime: '08:00', endTime: '09:00' }),
      makeAppt({ id: 'b', ramp: 1, startTime: '09:00', endTime: '10:30' }),
    ];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findNextSlot(existing, form)).toEqual({ startTime: '10:30', endTime: '11:30' });
  });

  it('returns null when there is no room left before closing time (21:00)', () => {
    const existing = [makeAppt({ id: 'a', ramp: 1, startTime: '20:00', endTime: '21:00' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '20:30', endTime: '21:30' };
    expect(findNextSlot(existing, form)).toBeNull();
  });

  it('does not consider a different ramp when looking for conflicts', () => {
    const existing = [makeAppt({ id: 'a', ramp: 2, startTime: '08:00', endTime: '09:00' })];
    const form = { ramp: 1 as const, date: '2026-08-10', startTime: '08:00', endTime: '09:00' };
    expect(findNextSlot(existing, form)).toEqual({ startTime: '08:00', endTime: '09:00' });
  });
});
