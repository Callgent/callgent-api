import { Module } from '@nestjs/common';
import { AuthTokensService } from './auth-tokens.service';

@Module({
  providers: [AuthTokensService],
  exports: [AuthTokensService],
})
export class AuthTokensModule {}
