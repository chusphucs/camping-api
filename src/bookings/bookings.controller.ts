import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** Public: place a guest booking. Returns the created booking with its code. */
  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookings.create(dto);
  }

  /**
   * Public: look up your own booking history by phone + name. POST (not GET) so
   * the PII payload stays out of URLs, access logs and URL-keyed caches. Tighter
   * per-route throttle than the global 120/min to deter scraping.
   */
  @Post('lookup')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Look up booking history by phone + name (public)',
    description:
      'Requires matching phone AND name. Defaults to bookings placed in the last 7 days. Returns codes, status, dates and items.',
  })
  lookup(@Body() dto: LookupBookingDto) {
    return this.bookings.lookup(dto);
  }
}
