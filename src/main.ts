import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loggerConfig } from './logger/logger.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: loggerConfig });

  const config = new DocumentBuilder()
    .setTitle('Compass Test app')
    .setDescription(
      'This app is used for testing the compass app in devops days hackathon 2026',
    )
    .setVersion('1.0')
    .addTag('compass-test')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
