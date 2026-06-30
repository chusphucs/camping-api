import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  /** Liveness + a real (lightweight) DB round-trip so a bad SUPABASE_URL is caught. */
  @Get()
  async check() {
    const { error } = await this.supabase.db
      .from('categories')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    return {
      status: error ? 'degraded' : 'ok',
      db: error ? 'down' : 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
