import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [UsersModule],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
