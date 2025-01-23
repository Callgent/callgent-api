import {
    Propagation,
    Transactional,
    TransactionHost,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { LlmCompletionEvent } from '../../agents/events/llm-completion.event';
import { LLMResponse } from '../../agents/llm.service';
import { DeepseekPricing } from '../dto/model-pricing.interface';

@Injectable()
export class TransactionHistoryListener {

    constructor(
        private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    ) { }

    @Transactional(Propagation.RequiresNew)
    @OnEvent(LlmCompletionEvent.eventName, { async: false })
    async handleLlmCompletion(event: LlmCompletionEvent) {
        const prisma = this.txHost.tx as PrismaClient;
        const userId = 'TEST_USER_ID'; // FIXME
        const { model, usage } = event.response;
        const { price, pricingMethod } = await prisma.llmModelPricing.findUnique({
            where: { modelName: model },
            select: {
                price: true,
                pricingMethod: true
            },
        });
        const { total_price, amount_receivable } = this[pricingMethod](
            price,
            usage,
        );
        await this.syncTransactionHistory(amount_receivable, total_price, usage, price, userId);
    }

    calcPrice_deepseek(
        price: DeepseekPricing,
        usage: LLMResponse['usage']
    ) {
        const pricePerInputToken =
            (price.pricePerInputToken * 1e9 * 100) / price.token;
        const pricePerOutputToken =
            (price.pricePerOutputToken * 1e9 * 100) / price.token;
        const pricePerCacheHitToken =
            (price.pricePerCacheHitToken * 1e9 * 100) / price.token;

        const total_price =
            usage.prompt_cache_miss_tokens * pricePerInputToken +
            usage.prompt_cache_hit_tokens * pricePerCacheHitToken +
            usage.completion_tokens * pricePerOutputToken;

        const amount_receivable = (total_price * 105) / 100;
        return { total_price, amount_receivable };
    }

    @Transactional()
    async syncTransactionHistory(
        amount_receivable: number,
        total_price: number,
        usage: LLMResponse['usage'],
        price: any,
        userId: string
    ) {
        const prisma = this.txHost.tx as PrismaClient;
        const userBalance = await prisma.userBalance.update({
            where: { userId },
            data: {
                balance: {
                    decrement: amount_receivable
                }
            }
        });
        await prisma.transactionHistory.create({
            data: {
                userBalanceId: userBalance.pk,
                type: 'TOKEN',
                amount: -amount_receivable,
                price: { amount_receivable, total_price, ...price },
                usage,
            },
        });
        return userBalance.balance;
    }
}

