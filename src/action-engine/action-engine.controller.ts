import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ActionEngineService } from './action-engine.service';
import { AlertmanagerPayloadDto } from './dto/alertmanager-webhook.dto';

@Controller('api/v1/action-engine')
export class ActionEngineController {
  private readonly logger = new Logger(ActionEngineController.name);

  constructor(private readonly actionEngineService: ActionEngineService) {}

  @Post('alert')
  @HttpCode(HttpStatus.OK)
  async handleAlert(@Body() payload: AlertmanagerPayloadDto) {
    this.logger.log(`Received alert payload: ${payload.status}`);
    return this.actionEngineService.processAlert(payload);
  }
}
