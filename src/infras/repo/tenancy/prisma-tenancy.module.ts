import {
  Global,
  Module
} from '@nestjs/common';
import {
  PrismaTenancyClientProvider,
  TENANTED_PRISMA_SERVICE,
} from './prisma-tenancy.provider';
import { PrismaTenancyService } from './prisma-tenancy.service';

/**
 * postgres specific module.
 * automatically `SELECT set_config('tenancy.tenantPk', cls.get('TENANT_ID'))`, before all operations.
 */
@Global()
@Module({
  providers: [PrismaTenancyService, PrismaTenancyClientProvider],
  exports: [PrismaTenancyService, TENANTED_PRISMA_SERVICE],
})
export class PrismaTenancyOnPgModule {}
