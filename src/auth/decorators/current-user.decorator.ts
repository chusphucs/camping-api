import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Injects the authenticated admin user attached by AdminAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
