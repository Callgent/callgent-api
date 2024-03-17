import { Module } from '@nestjs/common';
import { JwtAuthModule } from './jwt/jwt.module';
import { LocalAuthModule } from './local/local-auth.module';
import { OAuthClientModule } from './oauth-client/oauth-client.module';

@Module({
  imports: [LocalAuthModule, JwtAuthModule, OAuthClientModule],
})
export class AuthModule {}
