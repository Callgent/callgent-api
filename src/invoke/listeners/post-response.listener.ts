import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { BillingService } from '../../billing/billing.service';
import { RealmPricingVO } from '../../callgent-realms/dto/realm-pricing.vo';
import { Utils } from '../../infras/libs/utils';
import { PostResponseEvent } from '../events/post-response.event';
import { InvokeService } from '../invoke.service';
import { AbstractTxListener } from './abstract-tx.listener';

/**
 * commit billing tx after invoking based on RealmPricingVO
 */
@Injectable()
export class PostResponseListener extends AbstractTxListener {
  private readonly logger = new Logger(PostResponseListener.name);
  constructor(
    private readonly billingService: BillingService,
    invokeService: InvokeService,
  ) {
    super(invokeService);
  }

  @Transactional()
  @OnEvent(PostResponseEvent.eventName, { suppressErrors: false })
  async handleEvent(event: PostResponseEvent) {
    this.logger.debug('%j: Handling event,', event);
    const { response, reqEvent } = event;
    const txId = this.getTxId(reqEvent);

    //  if response is not ok
    if (response.status && response.status >= 300)
      return this.billingService.rollback(txId);

    return this.billingService.commit(txId, async (tx) => {
      const pricing: RealmPricingVO = tx.refData as any;
      if (pricing?.perRequest)
        return new Decimal(-Math.abs(pricing.perRequest));

      if (pricing?.perResponse) {
        // (response) => int
        const fun = Utils.toFunction(pricing.perResponse);
        const amount = fun(response);
        if (amount) return new Decimal(-Math.abs(amount));
      }

      return new Decimal(0);
    });
  }
}
