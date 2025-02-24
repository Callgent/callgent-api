import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LlmCompletionEvent } from '../../agents/events/llm-completion.event';
import { TransactionsService } from '../../transactions/transactions.service';
import { BillingService } from '../billing.service';

@Injectable()
export class LlmCompletionListener {
  constructor(
    private readonly billingService: BillingService,
    private readonly transactionsService: TransactionsService,
  ) {}

  @Transactional(Propagation.RequiresNew)
  @OnEvent(LlmCompletionEvent.eventName, {
    async: true,
    promisify: true,
    suppressErrors: false,
  })
  async handleLlmCompletion(event: LlmCompletionEvent) {
    const { res, paidBy } = event;
    if (!res) return this.transactionsService.check(paidBy);

    const refData = { ...res, choices: undefined };
    return this.billingService.addModelExpense(res.id, paidBy, refData);
  }
}
