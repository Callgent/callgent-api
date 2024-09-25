import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { Global, Module, OnModuleInit } from '@nestjs/common';
import {
  PrismaModule,
  PrismaService,
  providePrismaClientExceptionFilter,
} from 'nestjs-prisma';
// allow explicit queries/update for soft deleted records: deleted: true
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { ClsModule } from 'nestjs-cls';
import { mainPrismaServiceOptions } from './prisma.middlewares';
import { PrismaTenancyOnPgModule } from './tenancy/prisma-tenancy.module';
import { TENANTED_PRISMA_SERVICE } from './tenancy/prisma-tenancy.provider';
import { ValidatorModule } from './validators/validator.module';

@Global()
@Module({
  imports: [
    PrismaModule.forRootAsync({
      isGlobal: true,
      useFactory: mainPrismaServiceOptions,
      inject: [ConfigService],
    }),
    PrismaTenancyOnPgModule,
    // redis cache: https://docs.nestjs.com/techniques/caching#:~:text=%5B%0A%20%20%20%20CacheModule.-,register,-%3CRedisClientOptions%3E
    CacheModule.register({
      isGlobal: true,
      ttl: 2,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          // if PrismaModule is not global, we need to make it available to the plugin
          // imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({
            // each adapter has its own options, see the adapter docs for more info
            prismaInjectionToken: TENANTED_PRISMA_SERVICE,
          }),
        }),
      ],
    }),
    ValidatorModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor, // global controller get cache
    },
    providePrismaClientExceptionFilter(),
  ],
})
export class ReposModule implements OnModuleInit {
  constructor(private readonly prismaService: PrismaService) {}

  onModuleInit() {
    this.prismaService.$on('query', (e) => {
      const sql = e.query.trim().toLowerCase();
      if (
        sql.startsWith('select') ||
        sql.startsWith('insert') ||
        sql.startsWith('update') ||
        sql.startsWith('delete')
      )
        console.log(
          `\x1b[33m[SQL]\x1b[0m: ${e.query}; \x1b[34m${e.params}\x1b[0m`,
        );
    });
  }
}
