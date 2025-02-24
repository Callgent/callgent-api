import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Utils } from '../../libs/utils';

export class JwtPayload {
  /** token unique id */
  jti?: string;
  /** subject uuid */
  sub: string;
  /** issuer id or name, e.g. google; user issue token to API */
  iss?: string;
  /** audience id or type, e.g. email,appKey */
  aud?: string;
  id?: number;
  tenantPk?: number;
  scope?: string | string[];
  username?: string;
  nickname?: string;
  [key: string]: any;
}

@Injectable()
export class JwtAuthService {
  expiresIn: string;

  constructor(
    public readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.expiresIn = configService.getOrThrow<string>('JWT_EXPIRES_IN');
  }

  sign(payload: JwtPayload) {
    // TODO emit event to revoke old tokens
    const n = Date.now();
    payload.iat = Math.floor(n / 1000);
    payload.jti = Utils.intToBase64(n) + Utils.uuid({ size: 2, raw: true });
    return this.jwtService.sign(payload, { expiresIn: this.expiresIn });
  }

  /**
   * @returns decoded object
   * @throws UnauthorizedException
   */
  verify(token: string): JwtPayload {
    // TODO emit event to invalidate revoked token
    try {
      return this.jwtService.verify(token, { complete: true })?.payload;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}
