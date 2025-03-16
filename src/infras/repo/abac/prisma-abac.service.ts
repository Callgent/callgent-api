import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

/**
 * Attribute based access control (ABAC) context values
 * @description: automatically `SELECT set_config('abac.tenantPk', cls.get('TENANT_ID')), set_config('abac.userId', cls.get('USER_ID'))`, before each operation.
 */
@Injectable()
export class AbacContextService {
  constructor(readonly cls: ClsService) {}

  private static readonly TENANT_ID_KEY = 'TENANT_ID';
  private static readonly USER_ID_KEY = 'USER_ID';

  setTenantId(tenantPk: number) {
    this.cls.set(AbacContextService.TENANT_ID_KEY, tenantPk);
  }

  getTenantId(): number {
    return this.cls.get(AbacContextService.TENANT_ID_KEY);
  }

  setUserId(userId: string) {
    this.cls.set(AbacContextService.USER_ID_KEY, userId);
  }
  getUserId(): string {
    return this.cls.get(AbacContextService.USER_ID_KEY);
  }

  /**
   * @param bypass default true
   */
  async bypassAbac(tx: PrismaClient, bypass = true) {
    return tx.$executeRawUnsafe(
      `SELECT set_config('abac.bypass_rls', '${bypass ? 'on' : 'off'}', true)`,
    );
  }
}
