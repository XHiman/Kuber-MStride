import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { getAdminAllowedOrigins } from './admin/admin-origin';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const standardJsonParser = express.json();
  const adminImportJsonParser = express.json({ limit: '50mb' });
  app.use((request, response, next) => {
    const isAdminImport = request.method === 'POST' && (
      request.path === '/adminX/api/database/restore' ||
      request.path.startsWith('/adminX/api/import/')
    );
    (isAdminImport ? adminImportJsonParser : standardJsonParser)(request, response, next);
  });
  app.use(express.urlencoded({ extended: true }));

  app.enableCors({
    origin: getAdminAllowedOrigins(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const serverEnv = (globalThis as typeof globalThis & {
    process?: { env?: { PORT?: string; HOST?: string } };
  }).process?.env;
  const port = serverEnv?.PORT || 3001;
  const host = serverEnv?.HOST || '0.0.0.0';

  await app.listen(port, host);
}

bootstrap();