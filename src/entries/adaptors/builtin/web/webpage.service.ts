import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { PrismaTenancyService } from '../../../../infra/repo/tenancy/prisma-tenancy.service';
import { ClientRequestEvent } from '../../../events/client-request.event';

@Injectable()
export class WebpageService {
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(ModulesContainer)
    private readonly modulesContainer: ModulesContainer,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tenancyService: PrismaTenancyService,
  ) {}

  /** Generate webpage[view/model/view-model], then respond the src code */
  @Transactional()
  async genWebpage(
    data: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    data.stopPropagation = true; // stop event propagation
    return { data };
  }
}
