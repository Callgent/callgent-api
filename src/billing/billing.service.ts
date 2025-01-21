import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { LlmCompletionEvent } from '../agents/events/llm-completion.event';
import { LLMResponse } from '../agents/llm.service';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_KEY'), {
      apiVersion: this.configService.get('API_VERSION'),
    });
  }

  @Transactional(Propagation.RequiresNew)
  @OnEvent(LlmCompletionEvent.eventName, { async: true })
  async handleLlmCompletion(event: LlmCompletionEvent) {
    const prisma = this.txHost.tx as PrismaClient;
    const { model, usage } = event.response;
    const { price } = (await prisma.llmModelPricing.findUnique({
      where: { modelName: model },
      select: { price: true },
    })) as any;
    const { total_price, amount_receivable } = await this.calculateUsageCost(
      price,
      usage,
    );
    await this.syncTransactionHistory(amount_receivable, total_price, usage);
  }

  @Transactional()
  async syncTransactionHistory(
    amount_receivable: number,
    total_price: number,
    usage: LLMResponse['usage'],
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const userBalance = await prisma.userBalance.update({
      where: { userId: 's2JW5xUlpE__7FjPTUZYDc_gp' },
      data: { balance: { decrement: amount_receivable } },
    });
    await prisma.transactionHistory.create({
      data: {
        userBalanceId: userBalance.pk,
        type: 'token',
        amount: -amount_receivable,
        price: { amount_receivable, total_price },
        usage,
      },
    });
  }

  @Transactional()
  async calculateUsageCost(price: any, usage: LLMResponse['usage']) {
    const pricePerInputToken =
      (price.pricePerInputToken * 1e9 * 100) / price.token;
    const pricePerOutputToken =
      (price.pricePerOutputToken * 1e9 * 100) / price.token;
    const pricePerCacheHitToken =
      ((price.pricePerCacheHitToken || price.pricePerInputToken) * 1e9 * 100) /
      price.token;

    const {
      prompt_tokens,
      completion_tokens,
      prompt_cache_hit_tokens = 0,
      prompt_cache_miss_tokens = prompt_tokens,
    } = usage;

    const total_price =
      prompt_cache_miss_tokens * pricePerInputToken +
      prompt_cache_hit_tokens * pricePerCacheHitToken +
      completion_tokens * pricePerOutputToken;

    const amount_receivable = total_price * 1.05;

    return {
      total_price: total_price,
      amount_receivable: amount_receivable,
    };
  }

  // Create a Stripe payment session
  @Transactional()
  async createPaymentSession(amount: number, currency: string, userid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    const userBalance = await prisma.userBalance.upsert({
      where: { userId: userid },
      update: {},
      create: {
        userId: userid,
        balance: 0,
        currency: 'USD',
      },
    });
    const redirect_url =
      this.configService.get('CALLGENT_SITE_URL') + '/pricing';
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'Recharge Token Balance' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: redirect_url,
      cancel_url: redirect_url,
      metadata: { userid },
    });
    await prisma.transactionHistory.create({
      data: {
        userBalanceId: userBalance.pk,
        type: 'payment',
        amount: amount * 1000000000,
        stripeId: session?.id,
        price: { amount },
      },
    });
    return session;
  }

  // Payment successful
  @Transactional()
  async handleStripeWebhook(event: Stripe.Event) {
    const prisma = this.txHost.tx as PrismaClient;
    switch (event.type) {
      case 'checkout.session.completed':
        const { metadata, amount_subtotal, id, amount_total } =
          event.data.object;
        const userid = metadata.userid;
        const balance = await prisma.userBalance.update({
          where: { userId: userid },
          data: { balance: { increment: amount_subtotal * 1000000000 } },
          select: {
            balance: true,
            userId: true,
            createdAt: true,
            updatedAt: true
          }
        });
        await prisma.transactionHistory.update({
          where: { stripeId: id },
          data: {
            price: { amount_subtotal, amount_total, state: 'completed' },
          },
        });
        return { ...balance, balance: balance.balance };
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        const session = event.data.object as Stripe.Checkout.Session;
        const useridFailed = session.metadata.userid;
        await prisma.transactionHistory.update({
          where: {
            stripeId: session.id,
          },
          data: {
            price: {
              amount_subtotal: session.amount_subtotal,
              amount_total: session.amount_total,
              state: 'failed',
            },
            deletedAt: new Date(),
          },
        });
        return { message: `Payment failed or expired for user ${useridFailed}`, status: 'failed' };
      default:
        throw new HttpException(
          `Unhandled event type: ${event.type}`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  @Transactional()
  async getPaymentDetails(userId: string) {
    if (!userId) {
      throw new UnauthorizedException('User not authorized');
    }
    const prisma = this.txHost.tx as PrismaClient;
    const userBalance = await prisma.userBalance.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        balance: 0,
        currency: 'USD',
      },
    });
    const transactionHistory = await prisma.transactionHistory.findMany({
      where: {
        userBalanceId: userBalance.pk,
        price: {
          path: ['state'],
          equals: 'completed',
        }
      },
      select: {
        type: true,
        amount: true,
        createdAt: true,
      },
    });
    return {
      data: transactionHistory,
      meta: { balance: userBalance.balance },
    };
  }
}
