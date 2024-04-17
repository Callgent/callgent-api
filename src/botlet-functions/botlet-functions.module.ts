import { Module } from '@nestjs/common';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { BotletFunctionsController } from './botlet-functions.controller';
import { BotletFunctionsService } from './botlet-functions.service';

@Module({
  imports: [EndpointsModule],
  providers: [BotletFunctionsService],
  controllers: [BotletFunctionsController],
  exports: [BotletFunctionsService],
})
export class BotletFunctionsModule {}
