import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SimulatorModule } from './simulator/simulator.module';
import { MetricsModule } from './observability/metrics.module';
import { CorrelationIdMiddleware } from './observability/correlation-id.middleware';
import { LogsModule } from './logs/logs.module';

@Module({
  imports: [MetricsModule, SimulatorModule, LogsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
