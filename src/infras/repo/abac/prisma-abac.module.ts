import { Global, Module } from '@nestjs/common';
import {
  PrismaAbacClientProvider,
  ABAC_PRISMA_SERVICE,
} from './prisma-abac.provider';
import { AbacContextService } from './prisma-abac.service';
import { providePrismaClientUnknownExceptionFilter } from './prisma-exception.filter';

/**
 * Attribute based access control (ABAC), based on postgres row level security (RLS).
 * - model.tenantPk: accessed only by same tenant;
 * - model.tenantPk_: read by all, written only by same tenant;
 * - model.createdBy: read by all, written only by same user;
 */
@Global()
@Module({
  providers: [
    AbacContextService,
    PrismaAbacClientProvider,
    providePrismaClientUnknownExceptionFilter(),
  ],
  exports: [AbacContextService, ABAC_PRISMA_SERVICE],
})
export class PrismaAbacOnPgModule {}
