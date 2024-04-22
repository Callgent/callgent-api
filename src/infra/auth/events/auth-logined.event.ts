import { JwtPayload } from '../jwt/jwt.service';

export class AuthLoginedEvent {
  public static readonly eventName = 'auth.logined' as const;

  constructor(public readonly user: JwtPayload) {}
}
