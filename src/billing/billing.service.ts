import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import Stripe from 'stripe';
import { Utils } from '../infras/libs/utils';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly transactionsService: TransactionsService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_KEY'), {
      apiVersion: this.configService.get('STRIPE_API_VERSION'),
    });
  }

  /** Create a Stripe payment session */
  async createStripePayment(amount: number, currency: string, userid: string) {
    const redirect_url =
      this.configService.get('CALLGENT_SITE_URL') + '/pricing';
    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'Top-up Balance' },
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
  }

  @Transactional()
  async handleStripeWebhook(payload: string | Buffer, sig: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        sig,
        this.configService.get('STRIPE_WEBHOOK_SECRET'),
      );
    } catch (err) {
      throw new BadRequestException('Error parsing webhook');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        const {
          id: txId,
          currency,
          metadata,
          amount_total, // cents
        } = event.data.object;
        const userid = metadata.userid;
        // $1 = 1e11
        const amount = new Decimal(amount_total * 1e9);

        await this.addRecharge(
          txId,
          amount,
          currency,
          userid,
          event.data.object,
        );
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        const session = event.data.object as Stripe.Checkout.Session;
        this.logger.warn(`Stripe payment failed or expired %j`, session);
      default:
        this.logger.warn(`Unhandled stripe event type: ${event.type}`);
    }
    return true;
  }

  @Transactional()
  async addRecharge(
    txId: string,
    amount: Decimal,
    currency: string,
    userId: string,
    refData: any,
  ) {
    if (!txId || !userId || !refData) throw new BadRequestException();
    return this.transactionsService.create({
      txId,
      userId,
      amount,
      currency,
      refData,
      type: 'RECHARGE',
    });
  }

  /**
   * @param txId unique transaction id from external system
   */
  @Transactional()
  async addModelExpense(
    txId: string,
    userId: string,
    refData: {
      usage: any;
      model: string;
      provider: string;
      price?: any;
    },
  ) {
    if (!txId || !userId || !refData) throw new BadRequestException();
    const { usage, model, provider = '' } = refData;
    const prisma = this.txHost.tx as PrismaClient;

    // get model price: matching provider or default
    const models = (
      await prisma.modelPricing.findMany({
        select: {
          model: true,
          provider: true,
          method: true,
          price: true,
          currency: true,
        },
        where: { model },
      })
    ).filter((m) => !m.provider || m.provider === provider);
    if (!models.length)
      throw new BadRequestException('ModelPricing not found: ' + model);

    // calculate amount
    const pricing =
      models.length > 1 ? models.find((m) => m.provider) : models[0];
    refData.price = pricing.price;
    const amount = this._calcModelAmount(usage, pricing).mul(-1);

    // create transaction
    return this.transactionsService.create({
      txId,
      userId,
      amount,
      refData,
      type: 'EXPENSE',
      currency: pricing.currency,
    });
  }

  private _calcModelAmount(
    usage: any,
    pricing: { method: string; price: any },
  ) {
    const m = Utils.toFunction(pricing.method); // TODO cache m
    const amount = m(usage, pricing.price);
    if (!(amount > 0))
      throw new Error('Invalid amount, usage: ' + JSON.stringify(usage));
    return new Decimal(amount);
  }
}
