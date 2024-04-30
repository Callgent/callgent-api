import { Module } from '@nestjs/common';
import { BotletFunctionsModule } from '../botlet-functions/botlet-functions.module';
import { BotletsModule } from '../botlets/botlets.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { TasksModule } from '../tasks/tasks.module';
import { TaskActionsService } from './task-actions.service';

@Module({
  providers: [{ provide: 'TaskActionsService', useClass: TaskActionsService }],
  imports: [BotletsModule, EndpointsModule, BotletFunctionsModule, TasksModule],
  exports: ['TaskActionsService'],
})
export class TaskActionsModule {}
