import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService wraps PrismaClient and:
 * 1. Connects on module init and disconnects on module destroy (proper lifecycle).
 * 2. Logs slow queries (> 2000ms) as warnings in any environment.
 * 3. Logs all queries in development for debugging.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly isProd = process.env.NODE_ENV === 'production';

  constructor() {
    super({
      log: [
        // Always capture slow query events
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });

    // Log slow queries (over 2 seconds) as warnings
    (this as any).$on('query', (event: { query: string; duration: number }) => {
      if (event.duration > 2000) {
        this.logger.warn(
          `Slow query (${event.duration}ms): ${event.query.substring(0, 200)}`,
        );
      } else if (!this.isProd) {
        // In development, log all queries at debug level
        this.logger.debug(`Query (${event.duration}ms): ${event.query.substring(0, 100)}`);
      }
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Health check — call this from a /health endpoint to verify
   * the database connection is alive.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
