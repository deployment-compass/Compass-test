// src/simulator/simulator.module.ts

import { Module } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorConfigService } from './simulator-config.service';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  controllers: [SimulatorController, LoggerModule],
  providers: [SimulatorConfigService],
})
export class SimulatorModule {}
