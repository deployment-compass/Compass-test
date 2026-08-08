import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loggerConfig } from './logger/logger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: loggerConfig });
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
