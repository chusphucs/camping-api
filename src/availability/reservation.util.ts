import { SupabaseClient } from '@supabase/supabase-js';
import { differenceInCalendarDays } from 'date-fns';
import { throwDbError } from '../common/errors/db-error';

/** Only these statuses hold (reserve) inventory. PENDING does not. */
export const RESERVING_STATUSES = ['CONFIRMED', 'PICKED_UP'];

export interface Interval {
  start: string;
  end: string;
  quantity: number;
}

/** Rental days = nights (end exclusive), minimum 1. */
export function rentalDaysBetween(start: string, end: string): number {
  return Math.max(1, differenceInCalendarDays(new Date(end), new Date(start)));
}

/**
 * Half-open overlap test on YYYY-MM-DD strings. Lexicographic comparison is
 * valid for zero-padded ISO date-only strings (enforced by the DTO), so no
 * Date parsing is needed.
 */
export function rangesOverlap(
  s1: string,
  e1: string,
  s2: string,
  e2: string,
): boolean {
  return s1 < e2 && e1 > s2;
}

/**
 * Maximum number of units concurrently demanded across a set of intervals
 * (sweep line). This is the correct "how many units are needed at once",
 * unlike summing every overlapping interval — disjoint intervals never stack.
 */
export function peakConcurrency(intervals: Interval[]): number {
  const events: { date: string; delta: number }[] = [];
  for (const iv of intervals) {
    events.push({ date: iv.start, delta: iv.quantity });
    events.push({ date: iv.end, delta: -iv.quantity });
  }
  // Same date: process ends (-) before starts (+) so an interval ending exactly
  // when another starts does NOT count as concurrent (half-open windows).
  events.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.delta - b.delta,
  );
  let current = 0;
  let peak = 0;
  for (const e of events) {
    current += e.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

/**
 * Committed reservation windows for a product (one per CONFIRMED/PICKED_UP
 * booking line). Uses the per-item date columns when present; falls back to the
 * parent booking's window if those columns have not been migrated yet, so
 * availability keeps working before the 0002 migration is applied.
 */
export async function reservedIntervals(
  db: SupabaseClient,
  productId: string,
): Promise<Interval[]> {
  const perItem = await db
    .from('booking_items')
    .select('quantity, start_date, end_date, bookings!inner(status)')
    .eq('product_id', productId)
    .in('bookings.status', RESERVING_STATUSES);

  if (!perItem.error) {
    return (perItem.data ?? []).map((r: any) => ({
      start: r.start_date,
      end: r.end_date,
      quantity: Number(r.quantity),
    }));
  }

  // 42703 = undefined_column: per-item date columns not migrated yet.
  if (perItem.error.code !== '42703') throwDbError(perItem.error);

  const envelope = await db
    .from('booking_items')
    .select('quantity, bookings!inner(status, start_date, end_date)')
    .eq('product_id', productId)
    .in('bookings.status', RESERVING_STATUSES);
  if (envelope.error) throwDbError(envelope.error);
  return (envelope.data ?? []).map((r: any) => {
    const b = Array.isArray(r.bookings) ? r.bookings[0] : r.bookings;
    return {
      start: b.start_date,
      end: b.end_date,
      quantity: Number(r.quantity),
    };
  });
}

/**
 * Peak units of a product reserved at any instant within [start, end) by
 * CONFIRMED/PICKED_UP bookings. To be free for the WHOLE window, available
 * units = inventory − this peak.
 */
export async function reservedQuantity(
  db: SupabaseClient,
  productId: string,
  start: string,
  end: string,
): Promise<number> {
  const overlapping = (await reservedIntervals(db, productId))
    .filter((iv) => rangesOverlap(iv.start, iv.end, start, end))
    // Clip to the query window so the peak is measured within [start, end).
    .map((iv) => ({
      start: iv.start < start ? start : iv.start,
      end: iv.end > end ? end : iv.end,
      quantity: iv.quantity,
    }));
  return peakConcurrency(overlapping);
}
