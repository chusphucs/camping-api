import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /** Public: quote availability + price for a date range and item list. */
  @Post('check')
  @HttpCode(200)
  check(@Body() dto: CheckAvailabilityDto) {
    return this.availability.check(dto);
  }
}
