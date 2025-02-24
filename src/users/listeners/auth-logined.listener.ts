import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuthLoginedEvent } from '../../infras/auth/events/auth-logined.event';
import { PrismaTenancyService } from '../../infras/repo/tenancy/prisma-tenancy.service';

/** set tenantPk into cls context */
@Injectable()
export class AuthLoginedListener {
  constructor(private readonly tenancyService: PrismaTenancyService) {}

  private readonly logger = new Logger(AuthLoginedListener.name);

  @OnEvent(AuthLoginedEvent.eventName)
  async handleEvent(event: AuthLoginedEvent) {
    event.user?.tenantPk &&
      this.tenancyService.setTenantId(event.user.tenantPk);
  }
}
