/**
 * Core availability calculation logic.
 * Pure functions — no side effects, no database calls.
 * Shared between dashboard, public API, and Inngest functions.
 */

import type {
  SchedulingConfig,
  StaffSchedule,
  StaffTimeBlock,
  StaffServiceArea,
  Appointment,
  DateOverride,
} from '@/types/database';

// ============================================================
// Types
// ============================================================

export interface AvailableSlot {
  staffMemberId: string;
  startTime: string;       // "HH:MM"
  endTime: string;         // "HH:MM"
  type: 'slot' | 'window';
}

export interface AvailabilitySummary {
  date: string;
  totalCapacity: number;
  bookedCount: number;
  spotsRemaining: number;
  isBlocked: boolean;
  availableSlots: AvailableSlot[];
}

export interface AvailabilityOptions {
  city?: string;
  zipCode?: string;
}

// ============================================================
// Helpers
// ============================================================

/** Get day-of-week (0=Sun, 6=Sat) from a date string "YYYY-MM-DD" */
export function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** Parse "HH:MM" or "HH:MM:SS" to minutes since midnight */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/** Format minutes since midnight to "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Check if two time ranges overlap */
function timeRangesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string
): boolean {
  const a0 = timeToMinutes(aStart);
  const a1 = timeToMinutes(aEnd);
  const b0 = timeToMinutes(bStart);
  const b1 = timeToMinutes(bEnd);
  return a0 < b1 && b0 < a1;
}

/** Check if a time falls within a range */
function timeInRange(time: string, rangeStart: string, rangeEnd: string): boolean {
  const t = timeToMinutes(time);
  const s = timeToMinutes(rangeStart);
  const e = timeToMinutes(rangeEnd);
  return t >= s && t < e;
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Check if a date is blocked site-wide (holiday, closure).
 */
export function isDateBlocked(
  date: string,
  overrides: DateOverride[]
): boolean {
  return overrides.some(o => o.override_date === date && o.is_blocked);
}

/**
 * Get staff members who cover a given area.
 * If no area filter provided, returns all staff IDs.
 * If a staff member has NO service areas assigned, they cover everywhere (default).
 */
export function getStaffForArea(
  staffAreas: StaffServiceArea[],
  allStaffIds: string[],
  options?: AvailabilityOptions
): string[] {
  if (!options?.city && !options?.zipCode) {
    return allStaffIds;
  }

  // Staff with no area assignments cover everywhere
  const staffWithAreas = new Set(staffAreas.map(a => a.staff_member_id));
  const staffWithoutAreas = allStaffIds.filter(id => !staffWithAreas.has(id));

  const matchingStaff = new Set<string>(staffWithoutAreas);

  for (const area of staffAreas) {
    if (options.zipCode && area.zip_code === options.zipCode) {
      matchingStaff.add(area.staff_member_id);
    } else if (options.city && area.city?.toLowerCase() === options.city.toLowerCase()) {
      matchingStaff.add(area.staff_member_id);
    }
  }

  return Array.from(matchingStaff);
}

/**
 * Check if a staff member is blocked during a specific time on a given date.
 */
function isStaffBlocked(
  staffId: string,
  date: string,
  startTime: string,
  endTime: string,
  blocks: StaffTimeBlock[]
): boolean {
  const staffBlocks = blocks.filter(
    b => b.staff_member_id === staffId && b.block_date === date
  );

  for (const block of staffBlocks) {
    // All-day block
    if (!block.start_time || !block.end_time) {
      return true;
    }
    // Time-range block — check overlap
    if (timeRangesOverlap(startTime, endTime, block.start_time, block.end_time)) {
      return true;
    }
  }

  return false;
}

/**
 * Count how many appointments a staff member has in a specific window/slot on a date.
 */
function countAppointmentsInWindow(
  staffId: string,
  date: string,
  windowStart: string,
  windowEnd: string,
  appointments: Appointment[]
): number {
  return appointments.filter(appt => {
    if (appt.staff_member_id !== staffId) return false;
    if (appt.scheduled_date !== date) return false;
    if (appt.status === 'cancelled' || appt.status === 'no_show') return false;

    // For time_slots mode: check if the scheduled_time is within the window
    if (appt.scheduled_time) {
      return timeInRange(appt.scheduled_time, windowStart, windowEnd);
    }

    // For time_windows mode: check if the appointment's window overlaps
    if (appt.time_window_start && appt.time_window_end) {
      return timeRangesOverlap(
        windowStart, windowEnd,
        appt.time_window_start, appt.time_window_end
      );
    }

    // Manual entries without specific time — just scheduled for the date
    // Count against the first window of the day
    return false;
  }).length;
}

/**
 * Count appointments for a specific exact time slot.
 */
function countAppointmentsAtSlot(
  staffId: string,
  date: string,
  slotTime: string,
  appointments: Appointment[]
): number {
  return appointments.filter(appt => {
    if (appt.staff_member_id !== staffId) return false;
    if (appt.scheduled_date !== date) return false;
    if (appt.status === 'cancelled' || appt.status === 'no_show') return false;
    if (!appt.scheduled_time) return false;
    // Compare HH:MM (strip seconds if present)
    const apptTime = appt.scheduled_time.substring(0, 5);
    const slot = slotTime.substring(0, 5);
    return apptTime === slot;
  }).length;
}

/**
 * Get all available slots/windows for a given date.
 * This is the main function — computes availability across all staff,
 * factoring in schedules, blocks, existing appointments, and area filtering.
 */
export function getAvailableSlots(
  config: SchedulingConfig,
  staffSchedules: StaffSchedule[],
  staffBlocks: StaffTimeBlock[],
  staffAreas: StaffServiceArea[],
  appointments: Appointment[],
  date: string,
  overrides: DateOverride[],
  allStaffIds: string[],
  options?: AvailabilityOptions
): AvailabilitySummary {
  // Check site-wide blocks
  if (isDateBlocked(date, overrides)) {
    return {
      date,
      totalCapacity: 0,
      bookedCount: 0,
      spotsRemaining: 0,
      isBlocked: true,
      availableSlots: [],
    };
  }

  const dayOfWeek = getDayOfWeek(date);

  // Filter to staff who cover the requested area
  const eligibleStaffIds = getStaffForArea(staffAreas, allStaffIds, options);

  // Get active schedules for this day of week, for eligible staff
  const daySchedules = staffSchedules.filter(
    s => s.day_of_week === dayOfWeek
      && s.is_active
      && eligibleStaffIds.includes(s.staff_member_id)
  );

  const availableSlots: AvailableSlot[] = [];
  let totalCapacity = 0;
  let bookedCount = 0;

  if (config.scheduling_mode === 'time_windows') {
    // Time windows mode: each schedule entry is a window with capacity
    for (const schedule of daySchedules) {
      const startTime = schedule.start_time.substring(0, 5);
      const endTime = schedule.end_time.substring(0, 5);

      // Check if staff member is blocked during this window
      if (isStaffBlocked(schedule.staff_member_id, date, startTime, endTime, staffBlocks)) {
        continue;
      }

      const booked = countAppointmentsInWindow(
        schedule.staff_member_id, date, startTime, endTime, appointments
      );

      totalCapacity += schedule.capacity;
      bookedCount += booked;

      const remaining = schedule.capacity - booked;
      if (remaining > 0) {
        // Add one slot per remaining capacity
        for (let i = 0; i < remaining; i++) {
          availableSlots.push({
            staffMemberId: schedule.staff_member_id,
            startTime,
            endTime,
            type: 'window',
          });
        }
      }
    }
  } else {
    // Time slots mode: each schedule defines a time range containing specific slot times
    for (const schedule of daySchedules) {
      const slotTimes = schedule.slot_times || [];
      const startTime = schedule.start_time.substring(0, 5);
      const endTime = schedule.end_time.substring(0, 5);

      for (const slotTime of slotTimes) {
        const slot = slotTime.substring(0, 5);

        // Check if staff is blocked at this time
        // Use a 1-hour window around the slot for block checking
        const slotMinutes = timeToMinutes(slot);
        const slotEnd = minutesToTime(slotMinutes + (config.booking_buffer_minutes || 60));

        if (isStaffBlocked(schedule.staff_member_id, date, slot, slotEnd, staffBlocks)) {
          continue;
        }

        const booked = countAppointmentsAtSlot(
          schedule.staff_member_id, date, slot, appointments
        );

        totalCapacity += 1; // Each slot has capacity of 1
        bookedCount += booked;

        if (booked === 0) {
          availableSlots.push({
            staffMemberId: schedule.staff_member_id,
            startTime: slot,
            endTime: slotEnd,
            type: 'slot',
          });
        }
      }
    }
  }

  return {
    date,
    totalCapacity,
    bookedCount,
    spotsRemaining: Math.max(0, totalCapacity - bookedCount),
    isBlocked: false,
    availableSlots,
  };
}

/**
 * Get total spots remaining for a date (across all staff).
 * Convenience wrapper around getAvailableSlots.
 */
export function getSpotsRemaining(
  config: SchedulingConfig,
  staffSchedules: StaffSchedule[],
  staffBlocks: StaffTimeBlock[],
  staffAreas: StaffServiceArea[],
  appointments: Appointment[],
  date: string,
  overrides: DateOverride[],
  allStaffIds: string[]
): number {
  const summary = getAvailableSlots(
    config, staffSchedules, staffBlocks, staffAreas,
    appointments, date, overrides, allStaffIds
  );
  return summary.spotsRemaining;
}

/**
 * Get spots remaining filtered by area (city/zip).
 */
export function getSpotsRemainingByArea(
  config: SchedulingConfig,
  staffSchedules: StaffSchedule[],
  staffBlocks: StaffTimeBlock[],
  staffAreas: StaffServiceArea[],
  appointments: Appointment[],
  date: string,
  overrides: DateOverride[],
  allStaffIds: string[],
  options: AvailabilityOptions
): number {
  const summary = getAvailableSlots(
    config, staffSchedules, staffBlocks, staffAreas,
    appointments, date, overrides, allStaffIds, options
  );
  return summary.spotsRemaining;
}

/**
 * Get availability for multiple dates (e.g., next 14 days for the booking widget calendar).
 */
export function getAvailabilityRange(
  config: SchedulingConfig,
  staffSchedules: StaffSchedule[],
  staffBlocks: StaffTimeBlock[],
  staffAreas: StaffServiceArea[],
  appointments: Appointment[],
  startDate: string,
  days: number,
  overrides: DateOverride[],
  allStaffIds: string[],
  options?: AvailabilityOptions
): AvailabilitySummary[] {
  const results: AvailabilitySummary[] = [];
  const [year, month, day] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, day);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    results.push(
      getAvailableSlots(
        config, staffSchedules, staffBlocks, staffAreas,
        appointments, dateStr, overrides, allStaffIds, options
      )
    );
  }

  return results;
}

/**
 * Deduplicate available windows for public display.
 * Multiple staff may have the same window — the public just sees
 * "7:00am - 11:00am (3 spots available)" not per-staff breakdown.
 */
export function aggregateSlotsForPublic(
  slots: AvailableSlot[]
): { startTime: string; endTime: string; spotsAvailable: number; type: 'slot' | 'window' }[] {
  const groups = new Map<string, { startTime: string; endTime: string; count: number; type: 'slot' | 'window' }>();

  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        startTime: slot.startTime,
        endTime: slot.endTime,
        count: 1,
        type: slot.type,
      });
    }
  }

  return Array.from(groups.values())
    .map(g => ({
      startTime: g.startTime,
      endTime: g.endTime,
      spotsAvailable: g.count,
      type: g.type,
    }))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}
