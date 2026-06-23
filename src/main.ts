import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // In production, only log errors and warnings.
    // In development, log everything including debug messages.
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const frontendUrl = configService.get<string>('app.frontendUrl');
  const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';

  // ── Security & Performance Middleware ────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // ── CORS ─────────────────────────────────────────────
  app.enableCors({
    origin: [
      frontendUrl,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'https://taskeo-blue.vercel.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ── API Versioning ────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // ── Global Pipes ─────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip fields not in the DTO
      forbidNonWhitelisted: false,  // Don't throw on extra fields (just strip them)
      transform: true,              // Auto-convert types (e.g. "1" → 1)
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    }),
  );

  // ── Global Filters & Interceptors ────────────────────
  // Order matters: filter catches errors, interceptors wrap the pipeline
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // ── Swagger (development only) ────────────────────────
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Taskeo API')
      .setDescription('Full API documentation for the Taskeo project management platform')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .addTag('Auth')
      .addTag('Users')
      .addTag('Projects')
      .addTag('Tasks')
      .addTag('Team')
      .addTag('Analytics')
      .addTag('Activity Logs')
      .addTag('Notifications')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // ── Graceful Shutdown ─────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);

  console.log(`\n🚀  Server running on: http://localhost:${port}`);
  if (nodeEnv !== 'production') {
    console.log(`📖  Swagger docs:      http://localhost:${port}/api/docs\n`);
  }
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
