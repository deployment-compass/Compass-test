import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionEngineController } from './action-engine.controller';
import { ActionEngineService } from './action-engine.service';
import { Incident } from '../incidents/entities/incident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Incident])],
  controllers: [ActionEngineController],
  providers: [ActionEngineService],
  exports: [ActionEngineService],
})
export class ActionEngineModule {}
