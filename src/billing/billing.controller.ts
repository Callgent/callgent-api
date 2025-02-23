import {
  Body,
  Controller,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../infras/auth/jwt/jwt.guard';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtGuard)
  @Post('payment')
  async createPaymentSession(@Body() paymentDto, @Req() req) {
    const { amount, currency } = paymentDto;
    const session = await this.billingService.createStripePayment(
      amount,
      currency,
      req.user.sub,
    );
    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  @Post('webhook')
  async handleStripeWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req,
  ) {
    const received = await this.billingService.handleStripeWebhook(
      req.rawBody,
      sig,
    );
    return { received };
  }

  @UseGuards(JwtGuard)
  @Post('details')
  async getTxDetails(
    @Query()
    {
      page,
      perPage,
    }: {
      page?: number;
      perPage?: number;
    },
    @Req() req,
  ) {
    page = page ? +page : undefined;
    perPage = perPage ? +perPage : undefined;

    const userId = req.user.sub;
    const tenant = await this.usersService.$getTenant(userId);
    const txs = await this.transactionsService.findMany({
      where: { userId },
      page,
      perPage,
    });
    (txs.meta as any).balance = tenant.balance;
    return txs;
  }
}
