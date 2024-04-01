import { Module } from '@nestjs/common';
import { EndpointsService } from '../endpoints/endpoints.service';
import { BotletApiActionsController } from './botlet-api-actions.controller';
import { BotletApiActionsService } from './botlet-api-actions.service';

@Module({
  providers: [BotletApiActionsService, EndpointsService],
  controllers: [BotletApiActionsController],
})
export class BotletApiActionsModule {}
