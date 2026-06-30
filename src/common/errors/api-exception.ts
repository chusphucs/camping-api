import { HttpException } from '@nestjs/common';

/**
 * An HttpException that carries a stable machine-readable `code` (and optional
 * `details`) which the AllExceptionsFilter serialises into the shared error
 * envelope: { statusCode, error, message, details?, path, timestamp }.
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

/** Factory helpers for the error codes the frontend relies on. */
export const ApiErrors = {
  validation: (message: string, details?: unknown) =>
    new ApiException(400, 'VALIDATION', message, details),
  missingToken: () =>
    new ApiException(401, 'MISSING_BEARER_TOKEN', 'Missing bearer token'),
  invalidToken: () =>
    new ApiException(401, 'INVALID_TOKEN', 'Invalid or expired token'),
  forbidden: (message = 'Admin role required') =>
    new ApiException(403, 'FORBIDDEN', message),
  productNotFound: (message = 'Product not found') =>
    new ApiException(404, 'PRODUCT_NOT_FOUND', message),
  notFound: (message = 'Resource not found') =>
    new ApiException(404, 'NOT_FOUND', message),
  itemsUnavailable: (message: string, details?: unknown) =>
    new ApiException(409, 'ITEMS_UNAVAILABLE', message, details),
  invalidStatusTransition: (message: string) =>
    new ApiException(409, 'INVALID_STATUS_TRANSITION', message),
  conflict: (message: string) => new ApiException(409, 'CONFLICT', message),
  internal: (message = 'Internal server error') =>
    new ApiException(500, 'INTERNAL', message),
};
