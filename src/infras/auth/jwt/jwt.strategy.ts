import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, JwtFromRequestFunction, Strategy } from 'passport-jwt';
import { AuthUtils } from '../auth.utils';
import { AuthLoginedEvent } from '../events/auth-logined.event';
import { JwtAuthService } from './jwt-auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtAuthService: JwtAuthService,
  ) {
    const jwtFromRequest = ExtractJwt.fromExtractors([
      // ExtractJwt.fromAuthHeaderAsBearerToken(), // For bearer token
      (request) => request?.headers['x-callgent-authorization'],
      (request) =>
        request &&
        request.cookies &&
        request.cookies[AuthUtils.getAuthCookieName(configService)],
    ]);
    super({
      jwtFromRequest,
      passReqToCallback: true,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
    this._jwtFromRequest = jwtFromRequest;
  }
  private _jwtFromRequest: JwtFromRequestFunction;

  async validate(_req: any, payload: any) {
    // const token = this._jwtFromRequest(req);
    // payload = this.jwtAuthService.verify(token); // verify if revoked
    // if (!payload) throw new UnauthorizedException('Token expired or revoked');

    await this.eventEmitter.emitAsync(
      AuthLoginedEvent.eventName,
      new AuthLoginedEvent(payload),
    );
    return payload;
  }
}
