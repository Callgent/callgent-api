import { Module, Global } from '@nestjs/common';
import {
  PrismaTenancyClientProvider,
  TENANTED_PRISMA_SERVICE,
} from './prisma-tenancy.provider';
import { PrismaModule } from 'nestjs-prisma';
import { PrismaTenancyService } from './prisma-tenancy.service';

/**
 * postgres specific module.
 * automatically `SELECT set_config('tenancy.tenantId', cls.get('TENANT_ID'))`, before all operations.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [PrismaTenancyService, PrismaTenancyClientProvider],
  exports: [PrismaTenancyService, TENANTED_PRISMA_SERVICE],
})
export class PrismaTenancyOnPgModule {}
