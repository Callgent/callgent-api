import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { TransactionHistoryListener } from './listeners/transaction-history.listeners';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    TransactionHistoryListener
  ],
})
export class BillingModule { }
