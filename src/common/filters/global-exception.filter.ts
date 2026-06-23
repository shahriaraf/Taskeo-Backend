import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Global exception filter that:
 * 1. Handles Prisma database errors with meaningful HTTP responses.
 * 2. Sanitizes error messages in production (never leaks stack traces).
 * 3. Logs all errors with method + path for easy debugging.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, errorResponse } = this.resolveException(exception);

    // Always log the full error on the server
    this.logger.error(
      `[${request.method}] ${request.url} → ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      ...errorResponse,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveException(exception: unknown): {
    status: number;
    errorResponse: object;
  } {
    // ── NestJS HTTP exceptions (most common) ─────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        return { status, errorResponse: exceptionResponse as object };
      }

      return {
        status,
        errorResponse: {
          success: false,
          error: { code: 'HTTP_ERROR', message: exceptionResponse },
        },
      };
    }

    // ── Prisma unique constraint violation (e.g. duplicate email) ──
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const fields = (exception.meta?.target as string[])?.join(', ') ?? 'field';
        return {
          status: HttpStatus.CONFLICT,
          errorResponse: {
            success: false,
            error: {
              code: 'DUPLICATE_ENTRY',
              message: `A record with this ${fields} already exists.`,
            },
          },
        };
      }

      // Prisma record not found (findUniqueOrThrow, etc.)
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          errorResponse: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'The requested record was not found.',
            },
          },
        };
      }

      // Prisma foreign key constraint violation
      if (exception.code === 'P2003') {
        return {
          status: HttpStatus.BAD_REQUEST,
          errorResponse: {
            success: false,
            error: {
              code: 'INVALID_REFERENCE',
              message: 'Referenced record does not exist.',
            },
          },
        };
      }

      // Generic Prisma error — log code but sanitize message in prod
      this.logger.error(`Prisma error code: ${exception.code}`, exception.message);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errorResponse: {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: this.isProd
              ? 'A database error occurred. Please try again.'
              : exception.message,
          },
        },
      };
    }

    // ── Prisma validation error (bad query input) ─────────
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        errorResponse: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: this.isProd
              ? 'Invalid data provided.'
              : exception.message,
          },
        },
      };
    }

    // ── Unknown errors ────────────────────────────────────
    if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorResponse: {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: this.isProd
            ? 'Something went wrong. Please try again.'
            : (exception instanceof Error ? exception.message : String(exception)),
        },
      },
    };
  }
}
