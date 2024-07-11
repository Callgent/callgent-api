import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AgentsModule } from './agents/agents.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthTokensModule } from './auth-tokens/auth-tokens.module';
import { CallgentFunctionsModule } from './callgent-functions/callgent-functions.module';
import { CallgentsModule } from './callgents/callgents.module';
import { EmailsModule } from './emails/emails.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EventListenersModule } from './event-listeners/event-listeners.module';
import { EventStoresModule } from './event-stores/event-stores.module';
import { AuthModule } from './infra/auth/auth.module';
import { LoggingModule } from './infra/logging/logging.module';
import { ReposModule } from './infra/repo/repos.module';
import { TaskActionsModule } from './task-actions/task-actions.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { CallgentTreeModule } from './bff-callgent-tree/callgent-tree.module';
import { BffCallgentFunctionsModule } from './bff-callgent-functions/bff-callgent-functions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env.' + (process.env.NODE_ENV || 'dev'), '.env'],
    }),
    LoggingModule,
    EventEmitterModule.forRoot(),
    ReposModule,
    AuthModule,
    UsersModule,
    CallgentsModule,
    TasksModule,
    AuthTokensModule,
    EndpointsModule,
    CallgentFunctionsModule,
    AgentsModule,
    TaskActionsModule,
    EventListenersModule,
    EventStoresModule,
    EmailsModule,
    CallgentTreeModule,
    BffCallgentFunctionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
