import { Module } from '@nestjs/common';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { BotletMethodsController } from './botlet-methods.controller';
import { BotletMethodsService } from './botlet-methods.service';

@Module({
  imports: [EndpointsModule],
  providers: [BotletMethodsService],
  controllers: [BotletMethodsController],
  exports: [BotletMethodsService],
})
export class BotletMethodsModule {}
