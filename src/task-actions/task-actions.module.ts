import { Module } from '@nestjs/common';
import { TaskActionsService } from './task-actions.service';

@Module({
  providers: [TaskActionsService]
})
export class TaskActionsModule {}
