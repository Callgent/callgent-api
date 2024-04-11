import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AgentsModule } from './agents/agents.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthTokensModule } from './auth-tokens/auth-tokens.module';
import { BotletMethodsModule } from './botlet-methods/botlet-methods.module';
import { BotletsModule } from './botlets/botlets.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { AuthModule } from './infra/auth/auth.module';
import { LoggingModule } from './infra/logging/logging.module';
import { ReposModule } from './infra/repo/repos.module';
import { TaskActionsModule } from './task-actions/task-actions.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

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
    BotletsModule,
    TasksModule,
    AuthTokensModule,
    EndpointsModule,
    BotletMethodsModule,
    AgentsModule,
    TaskActionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
