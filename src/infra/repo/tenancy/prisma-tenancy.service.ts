import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaTenancyService {
  constructor(private readonly cls: ClsService) {}

  public static readonly TENANT_ID_KEY = 'TENANT_ID';

  setTenantId(tenantPk: number) {
    this.cls.enter({ ifNested: 'reuse' });
    this.cls.set(PrismaTenancyService.TENANT_ID_KEY, tenantPk);
  }

  getTenantId(): number {
    return this.cls.get(PrismaTenancyService.TENANT_ID_KEY);
  }

  /**
   * @param on `bypass` if true, this is default behavior
   */
  async bypassTenancy(tx: PrismaClient, on = true) {
    return tx.$executeRaw`SELECT set_config('tenancy.bypass_rls', 'on', ${on})`;
  }
}
