import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthController } from './auth.controller';
import { UsersService } from './users.service';
import { AuthLoginListener } from './listeners/auth-login.listener';
import { AuthLoginedListener } from './listeners/auth-logined.listener';

@Module({
  controllers: [UsersController, AuthController],
  providers: [UsersService, AuthLoginListener, AuthLoginedListener],
})
export class UsersModule {}
