import { Module } from '@nestjs/common';
import { BotletsController } from './botlets.controller';
import { BotletsService } from './botlets.service';

@Module({
  controllers: [BotletsController],
  providers: [BotletsService]
})
export class BotletsModule {}
