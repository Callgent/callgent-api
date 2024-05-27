import { Module } from '@nestjs/common';
import { CallgentFunctionsModule } from '../callgent-functions/callgent-functions.module';
import { CallgentsModule } from '../callgents/callgents.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { TasksModule } from '../tasks/tasks.module';
import { TaskActionsService } from './task-actions.service';

@Module({
  providers: [{ provide: 'TaskActionsService', useClass: TaskActionsService }],
  imports: [CallgentsModule, EndpointsModule, CallgentFunctionsModule, TasksModule],
  exports: ['TaskActionsService'],
})
export class TaskActionsModule {}
