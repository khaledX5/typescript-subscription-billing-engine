import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
  Logger.log(`Subscription billing engine listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
