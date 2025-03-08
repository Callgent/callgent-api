import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { BillingService } from '../../billing/billing.service';
import { PostAuthEvent } from '../../callgent-realms/events/post-auth.event';
import { InvokeService } from '../invoke.service';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { AbstractTxListener } from './abstract-tx.listener';

/**
 * prepare billing tx before invoking
 */
@Injectable()
export class PostAuthListener extends AbstractTxListener {
  private readonly logger = new Logger(PostAuthListener.name);
  constructor(
    private readonly billingService: BillingService,
    invokeService: InvokeService,
  ) {
    super(invokeService);
  }

  @Transactional()
  @OnEvent(PostAuthEvent.eventName, { suppressErrors: false })
  async handleEvent(event: PostAuthEvent) {
    this.logger.debug('%j: Handling event,', event);
    const { realm, reqEvent } = event;
    if (!realm.pricing) return;

    const txId = this.getTxId(reqEvent);
    const amount = new Decimal(realm.pricing.perRequest || 0);
    // prepare pricing tx
    this.billingService.addTx({
      txId,
      amount, // amount will be updated on commit
      status: 0, //pending
      type: 'EXPENSE',
      userId: reqEvent.paidBy,
      currency: realm.pricing.currency,
      refData: realm.pricing as any,
    });
  }
}
