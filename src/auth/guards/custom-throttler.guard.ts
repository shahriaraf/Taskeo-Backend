import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

/**
 * Custom throttler guard that throttles by user ID when authenticated,
 * and falls back to IP address for public (unauthenticated) routes.
 *
 * This prevents a single user from spamming the API even if they rotate IPs.
 *
 * HOW TO USE:
 * Replace the global ThrottlerGuard in app.module.ts with this:
 *
 *   { provide: APP_GUARD, useClass: CustomThrottlerGuard }
 *
 * You can also apply stricter limits on specific routes:
 *   @Throttle({ short: { limit: 3, ttl: 60000 } })
 *   @Post('login')
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: any,
    storageService: ThrottlerStorageService,
    reflector: Reflector,
    private configService: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Returns the throttle key.
   * - Authenticated requests: keyed by "user:{userId}"
   * - Unauthenticated requests: keyed by "ip:{ipAddress}"
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id ?? req.user?.sub;
    if (userId) {
      return `user:${userId}`;
    }
    // Fall back to IP for public routes (login, signup, refresh)
    return `ip:${req.ip}`;
  }
}
