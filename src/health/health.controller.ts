import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaClient } from '@prisma/client';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly prisma: PrismaHealthIndicator,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const prisma = this.txHost.tx as PrismaClient;

    return this.health.check([
      () =>
        this.http.pingCheck(
          'http-api',
          this.config.get('SITE_API_URL') + '/entries/adaptors',
        ),
      () => this.prisma.pingCheck('prisma', prisma),
    ]);
  }
}
