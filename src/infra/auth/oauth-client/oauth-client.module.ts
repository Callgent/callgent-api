import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthModule } from 'nestjs-oauth2';
import { OAuthClientController } from './oauth-client.controller';

@Global()
@Module({
  imports: [
    OAuthModule.forFeatureAsync({
      useFactory: (config: ConfigService) => ({
        providers: [
          {
            name: 'github',
            authorizeUrl: 'https://github.com/login/oauth/authorize',
            accessTokenUrl: 'https://github.com/login/oauth/access_token',
            clientId: config.get('GITHUB_OAUTH_CLIENT_ID'),
            clientSecret: config.get('GITHUB_OAUTH_CLIENT_SECRET'),
            redirectUri: config.get('SITE_API_URL') + `/auth/callback/github`,
          },
          {
            name: 'google',
            authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            accessTokenUrl: 'https://oauth2.googleapis.com/token',
            clientId: config.get('GOOGLE_OAUTH_CLIENT_ID'),
            clientSecret: config.get('GOOGLE_OAUTH_CLIENT_SECRET'),
            redirectUri: config.get('SITE_API_URL') + `/auth/callback/google`,
            scope: 'openid https://www.googleapis.com/auth/userinfo.email',
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [OAuthClientController],
})
export class OAuthClientModule {}
