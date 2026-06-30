import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ApiErrors } from '../../common/errors/api-exception';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Protects /admin/* routes. Verifies the Supabase JWT sent as a Bearer token
 * and requires the custom claim app_metadata.role === 'admin'. Without that
 * claim a merely-authenticated Supabase user is NOT an admin (403).
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiErrors.missingToken();
    }
    const token = header.slice(7);

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw ApiErrors.invalidToken();
    }
    const role = (data.user.app_metadata as Record<string, unknown> | undefined)
      ?.role;
    if (role !== 'admin') {
      throw ApiErrors.forbidden();
    }

    (req as any).user = data.user;
    return true;
  }
}
