import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Logs every incoming HTTP request and its response time.
 *
 * Output format:
 *   [LoggingInterceptor] GET /api/v1/tasks → 200 (45ms)
 *   [LoggingInterceptor] POST /api/v1/tasks → 201 (123ms) [user:abc123]
 *
 * Register globally in main.ts:
 *   app.useGlobalInterceptors(new LoggingInterceptor());
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const userId = (req as any).user?.id ?? (req as any).user?.sub;
    const userTag = userId ? ` [user:${userId}]` : '';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          this.logger.log(`${method} ${url} → ${res.statusCode} (${duration}ms)${userTag}`);
        },
        error: (err) => {
          const duration = Date.now() - start;
          const status = err?.status ?? 500;
          this.logger.warn(`${method} ${url} → ${status} (${duration}ms)${userTag}`);
        },
      }),
    );
  }
}
