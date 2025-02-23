import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { LlmCompletionListener } from './listeners/llm-completion.listeners';

@Module({
  controllers: [BillingController],
  imports: [TransactionsModule, UsersModule],
  providers: [BillingService, LlmCompletionListener],
})
export class BillingModule {}
