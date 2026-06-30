import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * The single, trusted Supabase client for the whole backend.
 *
 * It is created with the SERVICE_ROLE key, so it BYPASSES Row Level Security.
 * This is the only place data flows in/out of Postgres — all authorization lives
 * in NestJS (AdminAuthGuard), never in the browser. The service-role key must
 * never be exposed to the frontend.
 */
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  /** Table/RPC queries (bypasses RLS via the service-role key). */
  get db(): SupabaseClient {
    return this.client;
  }

  /** Auth admin API — used only to verify admin JWTs (auth.getUser(token)). */
  get auth(): SupabaseClient['auth'] {
    return this.client.auth;
  }
}
