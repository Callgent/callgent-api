import { JwtPayload } from '../jwt/jwt-auth.service';

export class AuthLoginedEvent {
  public static readonly eventName = 'auth.logined' as const;

  constructor(public readonly user: JwtPayload) {}
}
