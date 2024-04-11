import { Global, Module } from '@nestjs/common';
import { BotletMethodsModule } from '../botlet-methods/botlet-methods.module';
import { BotletsModule } from '../botlets/botlets.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { TasksModule } from '../tasks/tasks.module';
import { TaskActionsService } from './task-actions.service';
import { AgentsModule } from '../agents/agents.module';

@Global()
@Module({
  providers: [TaskActionsService],
  imports: [
    BotletsModule,
    EndpointsModule,
    BotletMethodsModule,
    TasksModule,
    AgentsModule,
  ],
  exports: [TaskActionsService],
})
export class TaskActionsModule {}
