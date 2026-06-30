import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminBookingsController } from './admin-bookings.controller';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
