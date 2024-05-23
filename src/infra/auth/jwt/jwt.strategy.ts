import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthLoginedEvent } from '../events/auth-logined.event';
import { AuthUtils } from '../auth.utils';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // ExtractJwt.fromAuthHeaderAsBearerToken(), // For bearer token
        (request) => request?.headers['x-botlet-authorization'],
        (request) =>
          request &&
          request.cookies &&
          request.cookies[AuthUtils.getAuthCookieName(configService)],
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // FIXME jwt blacklist for revoking/logout
    await this.eventEmitter.emitAsync(
      AuthLoginedEvent.eventName,
      new AuthLoginedEvent(payload),
    );
    return payload;
  }
}
