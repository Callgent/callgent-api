import { Module } from '@nestjs/common';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { CallgentsModule } from '../callgents/callgents.module';
import { EntriesModule } from '../entries/entries.module';
import { TasksModule } from '../tasks/tasks.module';
import { TaskActionsService } from './task-actions.service';

@Module({
  providers: [{ provide: 'TaskActionsService', useClass: TaskActionsService }],
  imports: [
    CallgentsModule,
    EntriesModule,
    EndpointsModule,
    TasksModule,
  ],
  exports: ['TaskActionsService'],
})
export class TaskActionsModule {}
