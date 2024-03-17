import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import axios from 'axios';
import { AuthLoginEvent } from '../../infra/auth/events/auth-login.event';
import { JwtPayload } from '../../infra/auth/jwt/jwt.service';
import { CreateUserIdentityDto } from '../../user-identities/dto/create-user-identity.dto';
import { UserDto } from '../dto/user.dto';
import { UsersService } from '../users.service';

@Injectable()
export class AuthLoginListener {
  private readonly logger = new Logger(AuthLoginListener.name);
  constructor(private readonly usersService: UsersService) {}

  @OnEvent(AuthLoginEvent.eventName, { async: false })
  async handleEvent(event: AuthLoginEvent) {
    this.logger.debug('Handling event: %j', { ...event, request: undefined });

    let user: UserDto;
    if (event.authType == 'password') {
      // validate username/password
      user = await this.usersService.login(event.username, event.credentials);
    } else if (event.authType == 'oauth') {
      // retrieve user info from oauth provider
      const userIdentity = await this.retrieveUserInfoFromOauth(event);

      // oauth tenant type always 1
      // const tenantType = event.request?.query?.tenantType || 1;
      user = await this.usersService.registerUserFromIdentity(userIdentity);
    } else throw new BadRequestException('Invalid auth type:' + event.authType);

    const payload: JwtPayload = {
      tenantId: user.tenantId,
      id: user.id,
      sub: user.uuid,
      iss: event.provider,
      aud: user.uuid,
    };
    return payload;
  }

  async retrieveUserInfoFromOauth(
    event: AuthLoginEvent,
  ): Promise<CreateUserIdentityDto> {
    const tokenObject = event.credentials;
    if (!tokenObject) throw new BadRequestException('Invalid oauth token');

    let u;
    switch (event.provider) {
      case 'github':
        // https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
        u = (
          await axios.get('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${tokenObject.accessToken}`,
              'Content-type': 'application/json',
            },
          })
        ).data;
        u = u && {
          provider: 'github',
          uid: u.id?.toString(),
          email: u.email,
          email_verified: !!u.email,
          name: u.name,
          avatar: u.avatar_url,
          credentials: JSON.stringify({
            ...tokenObject,
            access_token: undefined,
            token_type: undefined,
            // expiresTs: usually no expiration
          }),
          info: u,
        };
        break;
      case 'google':
        // https://any-api.com/googleapis_com/oauth2/docs/userinfo/oauth2_userinfo_get
        u = (
          await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              Authorization: `Bearer ${tokenObject.accessToken}`,
              'Content-type': 'application/json',
            },
          })
        ).data;
        u = u && {
          provider: 'google',
          uid: u.id?.toString(),
          email: u.email,
          email_verified: u.verified_email,
          // name: u.name,
          avatar: u.picture,
          credentials: JSON.stringify({
            ...tokenObject,
            access_token: undefined,
            expires_in: undefined,
            token_type: undefined,
            expiresTs: Math.floor(Date.now() / 1000) + tokenObject.expiresIn,
          }),
          info: u,
        };
        break;
      default:
        throw new BadRequestException(
          event,
          'Unsupported Oauth provider ' + event.provider,
        );
    }
    this.logger.debug('Oauth user: %j', u);
    return u;
  }
}
