import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuthLoginedEvent } from '../../infras/auth/events/auth-logined.event';
import { AbacContextService } from '../../infras/repo/abac/prisma-abac.service';

/** set tenantPk into cls context */
@Injectable()
export class AuthLoginedListener {
  constructor(private readonly tenancyService: AbacContextService) {}

  private readonly logger = new Logger(AuthLoginedListener.name);

  @OnEvent(AuthLoginedEvent.eventName)
  async handleEvent(event: AuthLoginedEvent) {
    const { sub: userId, tenantPk } = event.user || {};
    this.tenancyService.setTenantId(tenantPk);
    this.tenancyService.setUserId(userId);
  }
}
