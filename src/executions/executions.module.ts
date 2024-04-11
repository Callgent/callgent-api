import { Module } from '@nestjs/common';
import { CommandExecutor } from './command.executor';
import { ExecutionsService } from './executions.service';

@Module({
  providers: [CommandExecutor, ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
