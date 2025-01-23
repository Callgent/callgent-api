import {
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

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
        type: 'PAYMENT',
        amount: amount * 1e9,
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
            updatedAt: true,
          },
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
        return {
          message: `Payment failed or expired for user ${useridFailed}`,
          status: 'failed',
        };
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
    // FIXME pagination
    const transactionHistory = await prisma.transactionHistory.findMany({
      where: {
        userBalanceId: userBalance.pk,
        price: {
          path: ['state'],
          equals: 'completed',
        },
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
