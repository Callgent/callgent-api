import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { JwtAuthService } from '../../infras/auth/jwt/jwt-auth.service';
import { RealmSchemeVO } from '../dto/realm-scheme.vo';
import { RealmSecurityItem } from '../dto/realm-security.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';
import { AuthProcessor } from './auth-processor.base';

@Injectable()
export class JwtAuthProcessor extends AuthProcessor {
  constructor(private readonly jwtAuthService: JwtAuthService) {
    super();
  }
  /** @returns jwt:provider:in:name:realm */
  protected _getRealmKeys(realm: Partial<CallgentRealm>) {
    return [
      realm.authType,
      realm.provider,
      realm.scheme.in,
      realm.scheme?.name,
      realm.realm,
    ].filter((s) => s);
  }

  protected checkEnabled(scheme: RealmSchemeVO, realm: Partial<CallgentRealm>) {
    if (!realm.secret || !scheme.name || !scheme.in) return false;
    return this.validateSecretFormat(realm);
  }

  protected validateSecretFormat(
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
  ) {
    return typeof realm.secret == 'string';
  }

  protected isPerUser() {
    return false;
  }

  /** api-key is the token, needn't exchange process */
  async authProcess(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
    item: RealmSecurityItem,
    userIdentity: {
      provider: string;
      uid: string;
      credentials: string;
      userId?: string;
    },
  ): Promise<void | {
    data: ClientRequestEvent;
    resumeFunName?: 'postValidateToken';
  }> {
    const result = await this.validateToken(
      userIdentity.credentials,
      reqEvent,
      realm,
    );
    if (result) return result;

    throw new UnauthorizedException(
      'Invalid api-key token, callgentId=' + realm.callgentId,
    );
  }

  /** call validationUrl for validation */
  async _validateTokenByUrl(
    token: string,
    realm: CallgentRealm,
  ): Promise<boolean | void> {
    if (realm.provider === 'local') {
      try {
        const jwt = this.jwtAuthService.verify(token);
        return !!jwt;
      } catch (e) {
        return false;
      }
    }
    const req = {};
    this._readWriteToken(req, realm.scheme, token.toString());
    // FIXME: call validationUrl
    return false;
  }

  async _attachToken(
    token: string,
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<true> {
    // {"type":"jwt","in":"header","name":"x-callgent-authorization","provider":"local"}
    this._readWriteToken(
      reqEvent.context.req,
      realm.scheme,
      // user token first
      (token || realm.secret?.toString()) ?? '',
    );
    return true;
  }

  private _readWriteToken(
    req: any,
    scheme: RealmSchemeVO,
    value?: string,
  ): string {
    const read = typeof value !== 'string';
    if (!read) {
      if (!value) throw new ForbiddenException('Missing auth token');
      value = encodeURIComponent(value);
    }

    let { name, in: in0 } = scheme;
    switch (in0) {
      case 'cookie':
        if (!req.headers) req.headers = {};
        if (read) {
          const cookies = req.headers.cookie?.split(';') || [];
          const cookie = cookies.find((c) => c.trim().startsWith(name + '='));
          if (!cookie) return '';
          return cookie.split('=')[1];
        }
        req.headers.cookie = `${req.headers.cookie || ''}${
          req.headers.cookie ? ';' : ''
        }${name}=${value}`;
        break;
      case 'header':
        in0 += 's';
      case 'query':
        if (read) return req[in0]?.[name];
        if (!req[in0]) req[in0] = {};
        req[in0][name] = value;
        break;
      default:
        throw new Error('Invalid security scheme `in`: ' + in0);
    }
    return value;
  }

  /** check response from validationUrl */
  postValidateToken(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    throw new Error('Method not implemented.');
  }

  async providerCallback() {
    throw new Error('Not applicable.');
  }

  async postAcquireSecret() {
    throw new Error('Not applicable.');
  }

  async postExchangeToken() {
    throw new Error('Not applicable.');
  }

  getIdentity(
    req: any,
    realm: CallgentRealm,
  ): { provider: string; uid: string; credentials: string } {
    const token = this._readWriteToken(req, realm.scheme);
    const jwt = this.jwtAuthService.decode(token);
    return { provider: realm.provider, uid: jwt.sub, credentials: token };
  }
}
