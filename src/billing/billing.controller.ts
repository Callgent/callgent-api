import { Body, Controller, Get, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import Stripe from 'stripe';
import { JwtGuard } from '../infras/auth/jwt/jwt.guard';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) { }

  @UseGuards(new JwtGuard(true))
  @Post('payment')
  async createPaymentSession(@Body() paymentDto, @Req() req) {
    const { amount, currency } = paymentDto;
    const id = req.user?.sub;
    const session = await this.billingService.createPaymentSession(amount, currency, id);
    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  @Post('webhook')
  async handleStripeWebhook(@Req() { body }: { body: Stripe.Event }) {
    return await this.billingService.handleStripeWebhook(body);
  }

  @UseGuards(new JwtGuard(true))
  @Post('details')
  async getPaymentDetails(@Req() req) {
    return await this.billingService.getPaymentDetails(req.user?.sub);
  }

}
