import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaTenancyService {
  constructor(private readonly cls: ClsService) {}

  public static readonly TENANT_ID_KEY = 'TENANT_ID';

  setTenantId(tenantId: number) {
    this.cls.enter({ ifNested: 'reuse' });
    this.cls.set(PrismaTenancyService.TENANT_ID_KEY, tenantId);
  }

  getTenantId(): number {
    return this.cls.get(PrismaTenancyService.TENANT_ID_KEY);
  }

  async bypassTenancy(tx: PrismaClient) {
    await tx.$executeRaw`SELECT set_config('tenancy.bypass_rls', 'on', TRUE)`;
  }
}
