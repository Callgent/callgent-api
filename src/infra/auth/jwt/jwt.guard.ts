import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * auto refreshing jwt
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly allowUnauthorized: boolean = false) {
    super();
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    if (this.allowUnauthorized && !user) {
      return null;
    }
    return super.handleRequest(err, user, info, context);
  }
}
