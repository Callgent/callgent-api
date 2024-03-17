import { Injectable } from '@nestjs/common';
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
  tenantId?: number;
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
    payload.jti = Utils.uuid();
    payload.iat = Math.floor(Date.now() / 1000);
    return this.jwtService.sign(payload, { expiresIn: this.expiresIn });
  }

  /**
   * @returns decoded object
   */
  verify(token: string) {
    return (
      this.jwtService.verify(token) &&
      this.jwtService.decode(token, { json: true, complete: true })
    );
  }
}
