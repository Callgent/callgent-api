import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { AbacContextService } from '../infras/repo/abac/prisma-abac.service';

@Injectable()
export class TenantsService {
  constructor(private readonly tenancyService: AbacContextService) {}
  @Transactional()
  async runAs<T>(tenantPk: number, fn: () => Promise<T>): Promise<T> {
    const origPk = this.tenancyService.getTenantId();
    try {
      this.tenancyService.setTenantId(tenantPk);
      return await fn.apply(this);
    } finally {
      this.tenancyService.setTenantId(origPk);
    }
  }
}
