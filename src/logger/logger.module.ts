import { Module } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { winstonInstance } from './logger.config';

@Module({
  providers: [
    {
      provide: WINSTON_MODULE_PROVIDER,
      useValue: winstonInstance,
    },
  ],
  exports: [WINSTON_MODULE_PROVIDER],
})
export class LoggerModule {}
