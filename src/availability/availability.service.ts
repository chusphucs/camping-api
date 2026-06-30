import { Injectable } from '@nestjs/common';
import { ApiErrors } from '../common/errors/api-exception';
import { throwDbError } from '../common/errors/db-error';
import { SupabaseService } from '../supabase/supabase.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { rentalDaysBetween, reservedQuantity } from './reservation.util';

@Injectable()
export class AvailabilityService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Read-only availability + pricing quote, computed in the backend (no SQL
   * RPC). Each item carries its own rental window; days/pricing use that
   * window, and reserved units are summed per item. Only CONFIRMED/PICKED_UP
   * bookings reserve inventory (PENDING does not).
   */
  async check(dto: CheckAvailabilityDto) {
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const { data: products, error } = await this.supabase.db
      .from('products')
      .select('id, daily_rate, inventory_quantity, is_active')
      .in('id', ids);
    if (error) throwDbError(error);
    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));

    let allAvailable = true;
    let totalPrice = 0;
    const items: any[] = [];

    for (const item of dto.items) {
      const product = byId.get(item.productId);
      if (!product || product.is_active !== true) {
        throw ApiErrors.productNotFound();
      }

      const days = rentalDaysBetween(item.startDate, item.endDate);
      const reserved = await reservedQuantity(
        this.supabase.db,
        item.productId,
        item.startDate,
        item.endDate,
      );
      const available = Number(product.inventory_quantity) - reserved;
      const isAvailable = available >= item.quantity;
      if (!isAvailable) allAvailable = false;

      const lineTotal = Number(product.daily_rate) * days * item.quantity;
      if (isAvailable) totalPrice += lineTotal;

      items.push({
        productId: item.productId,
        startDate: item.startDate,
        endDate: item.endDate,
        rentalDays: days,
        requestedQuantity: item.quantity,
        availableQuantity: Math.max(available, 0),
        isAvailable,
        dailyRate: Number(product.daily_rate),
        lineTotal,
      });
    }

    return { allAvailable, items, totalPrice, currency: 'VND' };
  }
}
