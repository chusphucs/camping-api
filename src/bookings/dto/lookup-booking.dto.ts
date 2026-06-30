import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Public booking-history lookup. Requires BOTH phone AND name (matched together,
 * not OR) to deter enumeration. Date filters are OPTIONAL and intentionally do
 * NOT use IsNotPastDate — this is a HISTORY lookup, so past dates are the point.
 * The from/to ordering is validated in the service (after defaulting `from`),
 * so a `to`-only request is not rejected here.
 *
 * Extends PaginationQueryDto so `page`/`pageSize`/`sort` are accepted (the global
 * ValidationPipe uses forbidNonWhitelisted), but caps `pageSize` lower (max 20,
 * default 10) so one public request can't dump unbounded rows.
 */
export class LookupBookingDto extends PaginationQueryDto {
  @ApiProperty({ example: '0901234567' })
  // Same regex as BookingContactDto.phone so a customer can paste the exact
  // number they booked with.
  @Matches(/^[0-9+\s()-]{6,20}$/, {
    message: 'phone is not a valid phone number',
  })
  phone: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    description: 'created_at >= from (YYYY-MM-DD). Defaults to 7 days ago.',
    example: '2026-06-22',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'created_at <= to (inclusive, YYYY-MM-DD). Defaults to today.',
    example: '2026-06-29',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  @IsISO8601()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ default: 10, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  pageSize: number = 10;
}
