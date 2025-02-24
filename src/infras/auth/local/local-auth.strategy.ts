import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthLoginEvent } from '../events/auth-login.event';
import { AuthLoginedEvent } from '../events/auth-logined.event';

@Injectable()
export class LocalAuthStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly eventEmitter: EventEmitter2) {
    super({ passReqToCallback: true });
  }

  async validate(
    request: Request,
    username: string,
    password: string,
  ): Promise<any> {
    const [user] = await this.eventEmitter.emitAsync(
      AuthLoginEvent.eventName,
      new AuthLoginEvent('password', 'local', password, username, request),
    );
    if (!user) {
      throw new UnauthorizedException();
    }
    await this.eventEmitter.emitAsync(
      AuthLoginedEvent.eventName,
      new AuthLoginedEvent(user),
    );
    return user;
  }
}
