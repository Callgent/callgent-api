import { Module } from '@nestjs/common';
import { AuthTokensModule } from '../auth-tokens/auth-tokens.module';
import { AuthController } from './auth.controller';
import { AuthLoginListener } from './listeners/auth-login.listener';
import { AuthLoginedListener } from './listeners/auth-logined.listener';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthTokensModule],
  controllers: [UsersController, AuthController],
  providers: [UsersService, AuthLoginListener, AuthLoginedListener],
})
export class UsersModule {}
