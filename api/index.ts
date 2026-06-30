/**
 * Vercel serverless entry for the NestJS API.
 *
 * Mirrors `src/main.ts` exactly EXCEPT it never calls `app.listen()` — on Vercel
 * the platform owns the HTTP server, so we hand it the Express instance Nest built.
 * The bootstrapped app is cached across warm invocations (one cold start per instance).
 *
 * Routing: `vercel.json` rewrites every path to this `/api` function; the original
 * request URL is preserved, so Nest's global `/api` prefix matches as usual.
 */
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

type ExpressHandler = (req: Request, res: Response) => void;

let serverPromise: Promise<ExpressHandler> | null = null;

async function bootstrap(): Promise<ExpressHandler> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'api'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const corsOrigin = config.get<string>(
    'FRONTEND_ORIGIN',
    'http://localhost:5173',
  );
  app.enableCors({
    // FRONTEND_ORIGIN="*" allows any origin (safe here since credentials are
    // disabled); otherwise treat it as a comma-separated allowlist.
    origin:
      corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Camping Rental API')
    .setDescription('REST API for the camping gear rental site')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    `${config.get<string>('API_PREFIX', 'api')}/docs`,
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  // init() wires up the app WITHOUT opening a listening socket.
  await app.init();
  return app.getHttpAdapter().getInstance() as ExpressHandler;
}

export default async function handler(req: Request, res: Response) {
  serverPromise ??= bootstrap();
  const server = await serverPromise;
  server(req, res);
}
