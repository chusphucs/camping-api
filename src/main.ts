import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
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

  app.enableCors({
    origin: config
      .get<string>('FRONTEND_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
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

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(
    `🏕️  API ready at http://localhost:${port}/${config.get('API_PREFIX', 'api')}`,
  );
}
void bootstrap();
