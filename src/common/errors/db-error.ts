import { ApiErrors } from './api-exception';

/** Maps a supabase/Postgres error to a consistent ApiException. */
export function throwDbError(error: any, fallback = 'Database error'): never {
  switch (error?.code) {
    case '23505': // unique_violation
      throw ApiErrors.conflict(
        'A resource with the same unique value already exists',
      );
    case '23503': // foreign_key_violation
      throw ApiErrors.conflict(
        'Referenced resource does not exist, or this resource is still in use',
      );
    case '23514': // check_violation
      throw ApiErrors.validation('A value violates a database constraint');
    default:
      throw ApiErrors.internal(error?.message ?? fallback);
  }
}
