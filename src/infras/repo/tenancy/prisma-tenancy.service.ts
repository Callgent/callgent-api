import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaTenancyService {
  constructor(readonly cls: ClsService) {}

  private static readonly TENANT_ID_KEY = 'P-T_ID';
  private static readonly USER_ID_KEY = 'P-U_ID';

  setTenantId(tenantPk: number) {
    this.cls.set(PrismaTenancyService.TENANT_ID_KEY, tenantPk);
  }

  getTenantId(): number {
    return this.cls.get(PrismaTenancyService.TENANT_ID_KEY);
  }

  setUserId(userId: string) {
    this.cls.set(PrismaTenancyService.USER_ID_KEY, userId);
  }
  getUserId(): string {
    return this.cls.get(PrismaTenancyService.USER_ID_KEY);
  }

  /**
   * @param bypass default true
   */
  async bypassTenancy(tx: PrismaClient, bypass = true) {
    return tx.$executeRaw`SELECT set_config('tenancy.bypass_rls', ${bypass ? 'on' : 'off'}, true)`;
  }
}
