import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AgentsModule } from './agents/agents.module';
import { AuthTokensModule } from './auth-tokens/auth-tokens.module';
import { CallgentTreeModule } from './bff/callgent-tree/callgent-tree.module';
import { BffEndpointsModule } from './bff/endpoints/bff-endpoints.module';
import { CachedModule } from './cached/cached.module';
import { CallgentHubModule } from './callgent-hub/callgent-hub.module';
import { CallgentRealmsModule } from './callgent-realms/callgent-realms.module';
import { CallgentsModule } from './callgents/callgents.module';
import { EmailsModule } from './emails/emails.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { EntriesModule } from './entries/entries.module';
import { EventListenersModule } from './event-listeners/event-listeners.module';
import { EventStoresModule } from './event-stores/event-stores.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './infras/auth/auth.module';
import { LoggingModule } from './infras/logging/logging.module';
import { ReposModule } from './infras/repo/repos.module';
import { InvokeModule } from './invoke/invoke.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env.' + (process.env.NODE_ENV || 'dev'), '.env'],
    }),
    ThrottlerModule.forRoot([
      // {
      //   name: 'short',
      //   ttl: 1000,
      //   limit: 3,
      // },
      // {
      //   name: 'medium',
      //   ttl: 10000,
      //   limit: 20,
      // },
      {
        name: 'long',
        ttl: 60000,
        limit: 60,
      },
    ]),
    LoggingModule,
    EventEmitterModule.forRoot(),
    ReposModule,
    AuthModule,
    UsersModule,
    CallgentsModule,
    AuthTokensModule,
    EntriesModule,
    EndpointsModule,
    AgentsModule,
    EventListenersModule,
    EventStoresModule,
    EmailsModule,
    CallgentTreeModule,
    BffEndpointsModule,
    CallgentHubModule,
    CallgentRealmsModule,
    CachedModule,
    InvokeModule,
    HealthModule,
    FilesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
