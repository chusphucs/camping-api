import { Module } from '@nestjs/common';
import { AdminAuthGuard } from './guards/admin-auth.guard';

/** Provides the AdminAuthGuard (SupabaseService comes from the global module). */
@Module({
  providers: [AdminAuthGuard],
  exports: [AdminAuthGuard],
})
export class AuthModule {}
