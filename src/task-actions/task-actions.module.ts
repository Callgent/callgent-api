import { Module } from '@nestjs/common';
import { CallgentFunctionsModule } from '../callgent-functions/callgent-functions.module';
import { CallgentsModule } from '../callgents/callgents.module';
import { EntriesModule } from '../entries/entries.module';
import { TasksModule } from '../tasks/tasks.module';
import { TaskActionsService } from './task-actions.service';

@Module({
  providers: [{ provide: 'TaskActionsService', useClass: TaskActionsService }],
  imports: [
    CallgentsModule,
    EntriesModule,
    CallgentFunctionsModule,
    TasksModule,
  ],
  exports: ['TaskActionsService'],
})
export class TaskActionsModule {}
