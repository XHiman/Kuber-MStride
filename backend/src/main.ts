import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { getAdminAllowedOrigins } from './admin/admin-origin';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: getAdminAllowedOrigins(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Admin-Request'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port =
    (globalThis as typeof globalThis & {
      process?: { env?: { PORT?: string } };
    }).process?.env?.PORT || 3001;

  await app.listen(port, '0.0.0.0');
}

bootstrap();