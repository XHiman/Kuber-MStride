import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://kuber-mstride.onrender.com',
    ],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = (globalThis as typeof globalThis & { process?: { env?: { PORT?: string } } }).process?.env?.PORT || 3000;

  await app.listen(port, '0.0.0.0');
}
bootstrap();
