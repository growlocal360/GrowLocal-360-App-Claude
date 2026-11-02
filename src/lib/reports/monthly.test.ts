import { describe, it, expect } from 'vitest';
import { monthPeriod, previousMonthKey, currentMonthKey, pctChange } from './monthly';

describe('monthly report periods', () => {
  it('closed month runs first to last day', () => {
    const p = monthPeriod('2026-10', new Date('2026-11-15T12:00:00Z'));
    expect(p).toMatchObject({ start: '2026-10-01', end: '2026-10-31', monthToDate: false, label: 'October 2026' });
  });
  it('current month is month to date', () => {
    const p = monthPeriod('2026-11', new Date('2026-11-15T12:00:00Z'));
    expect(p).toMatchObject({ start: '2026-11-01', end: '2026-11-15', monthToDate: true });
  });
  it('previous month key wraps the year', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(previousMonthKey('2026-11')).toBe('2026-10');
    expect(currentMonthKey(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11');
  });
  it('percent change handles zero baseline', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(10, 0)).toBeNull();
  });
});
