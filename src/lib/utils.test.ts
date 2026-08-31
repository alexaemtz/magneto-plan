import { describe, it, expect } from 'vitest';
import { rampBlockRangeForDate, timeToMinutes, minutesToTime } from './utils';
import { RampBlock } from '@/types';

function makeBlock(overrides: Partial<RampBlock>): RampBlock {
  return {
    ramp: 1,
    startDate: '2026-08-10',
    startTime: '10:00',
    notes: 'Elevador descompuesto',
    ...overrides,
  };
}

describe('rampBlockRangeForDate', () => {
  it('returns null for a date before the block starts', () => {
    const block = makeBlock({ startDate: '2026-08-10' });
    expect(rampBlockRangeForDate(block, '2026-08-09')).toBeNull();
  });

  it('uses the exact start time on the first day', () => {
    const block = makeBlock({ startDate: '2026-08-10', startTime: '10:30' });
    expect(rampBlockRangeForDate(block, '2026-08-10')).toEqual({ startTime: '10:30', endTime: '21:00' });
  });

  it('covers the full 07:00–21:00 day for dates strictly inside the range', () => {
    const block = makeBlock({ startDate: '2026-08-10', endDate: '2026-08-15' });
    expect(rampBlockRangeForDate(block, '2026-08-12')).toEqual({ startTime: '07:00', endTime: '21:00' });
  });

  it('uses the exact end time on the last day', () => {
    const block = makeBlock({ startDate: '2026-08-10', endDate: '2026-08-15', endTime: '13:00' });
    expect(rampBlockRangeForDate(block, '2026-08-15')).toEqual({ startTime: '07:00', endTime: '13:00' });
  });

  it('defaults the end time to 21:00 when only an end date is set', () => {
    const block = makeBlock({ startDate: '2026-08-10', endDate: '2026-08-15', endTime: null });
    expect(rampBlockRangeForDate(block, '2026-08-15')).toEqual({ startTime: '07:00', endTime: '21:00' });
  });

  it('returns null for a date after the block ends', () => {
    const block = makeBlock({ startDate: '2026-08-10', endDate: '2026-08-15' });
    expect(rampBlockRangeForDate(block, '2026-08-16')).toBeNull();
  });

  it('never expires when there is no end date (indefinido)', () => {
    const block = makeBlock({ startDate: '2026-08-10', endDate: null });
    expect(rampBlockRangeForDate(block, '2027-01-01')).toEqual({ startTime: '07:00', endTime: '21:00' });
  });

  it('covers only the start time through end of day when the block starts and ends the same day', () => {
    const block = makeBlock({ startDate: '2026-08-10', startTime: '10:00', endDate: '2026-08-10', endTime: '14:00' });
    expect(rampBlockRangeForDate(block, '2026-08-10')).toEqual({ startTime: '10:00', endTime: '14:00' });
  });
});

describe('timeToMinutes / minutesToTime', () => {
  it('round-trips HH:MM through minutes and back', () => {
    expect(timeToMinutes('07:30')).toBe(450);
    expect(minutesToTime(450)).toBe('07:30');
  });
});
