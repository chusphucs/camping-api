import { Injectable } from '@nestjs/common';
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  subDays,
} from 'date-fns';
import { ApiErrors } from '../common/errors/api-exception';
import { throwDbError } from '../common/errors/db-error';
import {
  buildMeta,
  Paginated,
  pageRange,
} from '../common/dto/pagination-query.dto';
import { BOOKING_TRANSITIONS, BookingStatus } from '../common/types/enums';
import { businessToday } from '../common/validators/date.validators';
import {
  peakConcurrency,
  rentalDaysBetween,
  reservedIntervals,
} from '../availability/reservation.util';
import { SupabaseService } from '../supabase/supabase.service';
import { BookingContactDto, CreateBookingDto } from './dto/create-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';

const BOOKING_DETAIL_SELECT =
  '*, items:booking_items(id,product_id,quantity,start_date,end_date,daily_rate,line_total,name_snapshot,product:products(id,slug,name))';

/**
 * Slim column set for the public history lookup — no `select('*')`, so internal
 * columns (id, email, note, payment_status, ...) never leave the DB layer.
 */
const PUBLIC_LOOKUP_SELECT =
  'code,status,start_date,end_date,total_price,currency,created_at, items:booking_items(quantity,start_date,end_date,daily_rate,line_total,name_snapshot,product:products(slug))';

/** Inclusive offset for the business timezone (Asia/Ho_Chi_Minh, UTC+7, no DST). */
const BUSINESS_TZ_OFFSET = '+07:00';

@Injectable()
export class BookingsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Public: create a guest booking with per-item rental windows.
   *
   * Implemented in the backend (no SQL RPC) so it does not depend on database
   * functions being migrated. PENDING bookings do not reserve inventory, so the
   * per-item availability check here is advisory — it rejects obviously
   * unavailable requests; the real inventory commit happens at CONFIRM time.
   */
  async create(dto: CreateBookingDto) {
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const { data: products, error: pErr } = await this.supabase.db
      .from('products')
      .select('id, name, daily_rate, inventory_quantity, is_active')
      .in('id', ids);
    if (pErr) throwDbError(pErr);
    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
    for (const id of ids) {
      const p = byId.get(id);
      if (!p || p.is_active !== true) throw ApiErrors.productNotFound();
    }

    // Snapshot price + days per line item.
    const lines = dto.items.map((i) => {
      const product = byId.get(i.productId);
      const days = rentalDaysBetween(i.startDate, i.endDate);
      return {
        item: i,
        product,
        days,
        lineTotal: Number(product.daily_rate) * days * i.quantity,
      };
    });

    // Advisory availability per product: peak concurrent demand (committed
    // reservations + every cart line of that product) must fit inventory.
    // Using peak concurrency — not a sum of overlaps — so disjoint windows of
    // the same product don't falsely stack.
    for (const productId of ids) {
      const product = byId.get(productId);
      const committed = await reservedIntervals(this.supabase.db, productId);
      const cart = dto.items
        .filter((i) => i.productId === productId)
        .map((i) => ({
          start: i.startDate,
          end: i.endDate,
          quantity: i.quantity,
        }));
      const peak = peakConcurrency([...committed, ...cart]);
      if (peak > Number(product.inventory_quantity)) {
        throw ApiErrors.itemsUnavailable(
          'Some items are not available for the selected dates',
          [
            {
              productId,
              requestedQuantity: cart.reduce((s, c) => s + c.quantity, 0),
              availableQuantity: Math.max(
                Number(product.inventory_quantity) - peakConcurrency(committed),
                0,
              ),
            },
          ],
        );
      }
    }

    // Booking-level dates are the min/max envelope of the line windows.
    const envStart = dto.items
      .map((i) => i.startDate)
      .reduce((a, b) => (a < b ? a : b));
    const envEnd = dto.items
      .map((i) => i.endDate)
      .reduce((a, b) => (a > b ? a : b));
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);

    const booking = await this.insertBookingWithCode(
      dto.contact,
      envStart,
      envEnd,
      total,
    );

    const rows = lines.map((l) => ({
      booking_id: booking.id,
      product_id: l.item.productId,
      quantity: l.item.quantity,
      start_date: l.item.startDate,
      end_date: l.item.endDate,
      daily_rate: Number(l.product.daily_rate),
      line_total: l.lineTotal,
      name_snapshot: l.product.name,
    }));
    const { error: iErr } = await this.supabase.db
      .from('booking_items')
      .insert(rows);
    if (iErr) {
      // Roll back the parent booking so we never leave an item-less order.
      await this.supabase.db.from('bookings').delete().eq('id', booking.id);
      throwDbError(iErr, 'Failed to create booking');
    }

    return this.getDetail(booking.id);
  }

  /**
   * Insert the booking row with a unique YYYY-NNNN code. The number is the
   * NUMERIC max of this year's codes + 1 (not a lexicographic sort — so it is
   * correct past 9999). On a unique collision (concurrent allocation) we
   * re-read the max and retry with a little jitter so concurrent inserts drain.
   */
  private async insertBookingWithCode(
    contact: BookingContactDto,
    startDate: string,
    endDate: string,
    total: number,
  ) {
    const year = businessToday().slice(0, 4);

    for (let attempt = 0; attempt < 12; attempt++) {
      const next = (await this.maxBookingNumber(year)) + 1;
      const code = `${year}-${String(next).padStart(4, '0')}`;
      const { data, error } = await this.supabase.db
        .from('bookings')
        .insert({
          code,
          status: 'PENDING',
          start_date: startDate,
          end_date: endDate,
          full_name: contact.fullName,
          phone: contact.phone,
          email: contact.email,
          note: contact.note ?? null,
          total_price: total,
          currency: 'VND',
        })
        .select('id')
        .single();
      if (!error && data) return data;
      if (error?.code === '23505') {
        // Concurrent booking took this code — back off briefly, re-read, retry.
        await new Promise((r) =>
          setTimeout(r, 20 + Math.floor(Math.random() * 40)),
        );
        continue;
      }
      if (error) throwDbError(error, 'Failed to create booking');
    }
    throw ApiErrors.internal('Could not allocate a booking code');
  }

  /** Highest numeric suffix among this year's booking codes (0 if none). */
  private async maxBookingNumber(year: string): Promise<number> {
    const { data, error } = await this.supabase.db
      .from('bookings')
      .select('code')
      .like('code', `${year}-%`);
    if (error) throwDbError(error);
    return (data ?? []).reduce((max: number, row: any) => {
      const n = parseInt(String(row.code).split('-')[1] ?? '0', 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
  }

  async adminList(query: BookingQueryDto): Promise<Paginated<any>> {
    const { from, to } = pageRange(query.page, query.pageSize);
    let builder = this.supabase.db
      .from('bookings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) builder = builder.eq('status', query.status);
    if (query.from) builder = builder.gte('start_date', query.from);
    if (query.to) builder = builder.lte('start_date', query.to);
    if (query.q) {
      const safe = query.q.replace(/[%,()]/g, ' ').trim();
      if (safe) {
        builder = builder.or(
          `code.ilike.*${safe}*,full_name.ilike.*${safe}*,phone.ilike.*${safe}*,email.ilike.*${safe}*`,
        );
      }
    }

    const { data, error, count } = await builder;
    if (error) throwDbError(error);
    return {
      // Map raw rows through toResponse so list items match the Booking
      // contract (nested camelCase `contact`, camelCase dates/total) the
      // frontend expects. List rows have no joined items -> items: [].
      data: (data ?? []).map((row) => this.toResponse(row)),
      meta: buildMeta(query.page, query.pageSize, count ?? 0),
    };
  }

  /**
   * Public: look up a customer's own booking history by phone + name.
   *
   * Anti-enumeration: phone AND name must BOTH match (never the admin OR-substring
   * search). Phone is matched EXACTLY against a normalized (digits-only) column so
   * callers can't prefix-fish; name is an accent- & case-insensitive contains
   * against a normalized column. Filters on `created_at` (placement time),
   * defaulting to the last 7 days. Returns a slimmed shape (no email/note/id/
   * paymentStatus) plus items so the customer can see what they rented.
   */
  async lookup(dto: LookupBookingDto): Promise<Paginated<any>> {
    const phoneDigits = this.normalizePhone(dto.phone);
    // A 6–20 char phone with fewer than 6 digits can't be an exact match.
    if (phoneDigits.length < 6) {
      return { data: [], meta: buildMeta(dto.page, dto.pageSize, 0) };
    }
    const safeName = this.normalizeName(dto.name).replace(/%/g, ' ').trim();

    // Resolve the window on the business calendar. Default: last 7 days.
    const today = businessToday();
    const toDate = dto.to ?? today;
    const fromDate =
      dto.from ?? format(subDays(parseISO(today), 7), 'yyyy-MM-dd');
    if (fromDate > toDate) {
      throw ApiErrors.validation('`to` must be on or after `from`');
    }
    if (differenceInCalendarDays(parseISO(toDate), parseISO(fromDate)) > 90) {
      throw ApiErrors.validation('Date range cannot exceed 90 days');
    }
    // created_at is timestamptz: half-open [fromStart, toExclusive) window with
    // the business-tz offset so the whole `to` day is inclusive.
    const fromStart = `${fromDate}T00:00:00${BUSINESS_TZ_OFFSET}`;
    const toExclusive = `${format(addDays(parseISO(toDate), 1), 'yyyy-MM-dd')}T00:00:00${BUSINESS_TZ_OFFSET}`;

    const { from, to } = pageRange(dto.page, dto.pageSize);
    // Value-bound builder methods (.eq/.ilike) — never an interpolated .or(...)
    // filter string — so phone/name input can't break out of the filter grammar.
    const builder = this.supabase.db
      .from('bookings')
      .select(PUBLIC_LOOKUP_SELECT, { count: 'exact' })
      .eq('phone_normalized', phoneDigits)
      .ilike('full_name_normalized', `%${safeName}%`)
      .gte('created_at', fromStart)
      .lt('created_at', toExclusive)
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await builder;
    if (error) throwDbError(error);
    return {
      data: (data ?? []).map((row) => this.toPublicLookupResponse(row)),
      meta: buildMeta(dto.page, dto.pageSize, count ?? 0),
    };
  }

  async getDetail(id: string) {
    const { data, error } = await this.supabase.db
      .from('bookings')
      .select(BOOKING_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throwDbError(error);
    if (!data) throw ApiErrors.notFound('Booking not found');
    return this.toResponse(data);
  }

  async updateStatus(id: string, next: BookingStatus) {
    const { data: current, error: fetchError } = await this.supabase.db
      .from('bookings')
      .select('id,status')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throwDbError(fetchError);
    if (!current) throw ApiErrors.notFound('Booking not found');

    const allowed = BOOKING_TRANSITIONS[current.status as BookingStatus] ?? [];
    if (current.status !== next && !allowed.includes(next)) {
      throw ApiErrors.invalidStatusTransition(
        `Cannot change status from ${current.status} to ${next}`,
      );
    }

    const { error } = await this.supabase.db
      .from('bookings')
      .update({ status: next })
      .eq('id', id);
    if (error) throwDbError(error);
    return this.getDetail(id);
  }

  // ----- helpers -----

  /** Digits-only phone, mirroring the migration's `phone_normalized` column. */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Lowercased, accent-stripped name, mirroring the DB's `full_name_normalized`
   * column (lower(unaccent(full_name))). Postgres `unaccent` also folds đ/Đ → d,
   * which NFD decomposition does not, so we map it explicitly to stay in sync.
   */
  private normalizeName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  /**
   * Slimmed public projection for the history lookup. Deliberately omits id,
   * email, note, payment_status and the contact block (the caller already
   * supplied phone+name; we don't re-broadcast PII). Keeps code/status/dates/
   * total + items so the customer can review what they rented.
   */
  private toPublicLookupResponse(row: any) {
    const rentalDays = Math.max(
      1,
      differenceInCalendarDays(
        new Date(row.end_date),
        new Date(row.start_date),
      ),
    );
    return {
      code: row.code,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      rentalDays,
      currency: row.currency,
      totalPrice: Number(row.total_price),
      createdAt: row.created_at,
      items: (row.items ?? []).map((it: any) => ({
        quantity: it.quantity,
        startDate: it.start_date,
        endDate: it.end_date,
        dailyRate: Number(it.daily_rate),
        lineTotal: Number(it.line_total),
        // name_snapshot is jsonb {vi,en}; preserve that shape for the frontend.
        name: it.name_snapshot ?? it.product?.name ?? null,
        slug: it.product?.slug,
      })),
    };
  }

  private toResponse(row: any) {
    const rentalDays = Math.max(
      1,
      differenceInCalendarDays(
        new Date(row.end_date),
        new Date(row.start_date),
      ),
    );
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      paymentStatus: row.payment_status,
      startDate: row.start_date,
      endDate: row.end_date,
      rentalDays,
      currency: row.currency,
      totalPrice: Number(row.total_price),
      createdAt: row.created_at,
      contact: {
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        note: row.note,
      },
      items: (row.items ?? []).map((it: any) => ({
        productId: it.product_id,
        quantity: it.quantity,
        startDate: it.start_date,
        endDate: it.end_date,
        rentalDays:
          it.start_date && it.end_date
            ? Math.max(
                1,
                differenceInCalendarDays(
                  new Date(it.end_date),
                  new Date(it.start_date),
                ),
              )
            : undefined,
        dailyRate: Number(it.daily_rate),
        lineTotal: Number(it.line_total),
        name: it.name_snapshot ?? it.product?.name,
        slug: it.product?.slug,
      })),
    };
  }
}
