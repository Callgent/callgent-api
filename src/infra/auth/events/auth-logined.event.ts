import { JwtPayload } from '../jwt/jwt.service';

export class AuthLoginedEvent {
  public static readonly eventName = 'auth.logined';

  constructor(public readonly user: JwtPayload) {}
}
