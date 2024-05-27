import { Module } from '@nestjs/common';
import { CallgentsController } from './callgents.controller';
import { CallgentsService } from './callgents.service';

@Module({
  controllers: [CallgentsController],
  providers: [CallgentsService],
  exports: [CallgentsService],
})
export class CallgentsModule {}
