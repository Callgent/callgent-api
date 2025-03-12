import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { PrismaTenancyService } from '../infras/repo/tenancy/prisma-tenancy.service';

@Injectable()
export class TenantsService {
  constructor(private readonly tenancyService: PrismaTenancyService) {}
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
