import { Module } from '@nestjs/common';
import { loggerConfig } from './logger.config';

@Module({
  providers: [
    {
      provide: 'winston',
      useValue: loggerConfig,
    },
  ],
  exports: ['winston'],
})
export class LoggerModule {}
