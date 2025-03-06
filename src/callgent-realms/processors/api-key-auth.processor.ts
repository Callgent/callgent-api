import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { APIKeySecurityScheme, RealmSchemeVO } from '../dto/realm-scheme.vo';
import { RealmSecurityItem } from '../dto/realm-security.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';
import { AuthProcessor } from './auth-processor.base';

@Injectable()
export class ApiKeyAuthProcessor extends AuthProcessor {
  /** @returns ApiKey:provider:in:name:realm */
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
    realm: CallgentRealm,
    item: RealmSecurityItem,
    reqEvent: ClientRequestEvent,
  ): Promise<void | {
    data: ClientRequestEvent;
    resumeFunName?: 'postValidateToken';
  }> {
    const result = await this.validateToken(
      realm.secret as string,
      reqEvent,
      realm,
    );
    if (result) return result;

    throw new UnauthorizedException(
      'Invalid api-key token, callgentId=' + realm.callgentId,
    );
  }

  /** attach to validationUrl */
  async _validateTokenByUrl(
    token: string,
    realm: CallgentRealm,
  ): Promise<boolean | void> {
    // get validationUrl with token
  }

  async _attachToken(
    token: string,
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<true> {
    // {"type":"apiKey","in":"header","name":"x-callgent-authorization","provider":"local"}
    return this._readWriteToken(
      reqEvent.context.req,
      realm.scheme as any,
      false,
      // user token first
      token || (realm.secret as string),
    );
  }

  private _readWriteToken(
    req: any,
    scheme: APIKeySecurityScheme,
    read?: true,
  ): string;

  private _readWriteToken(
    req: any,
    scheme: APIKeySecurityScheme,
    read: false,
    value: string,
  ): true;

  private _readWriteToken(
    req: any,
    scheme: APIKeySecurityScheme,
    read: boolean,
    value?: string,
  ): true | string {
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
    return true;
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
    const token = this._readWriteToken(req, realm.scheme as any, true);
    return { provider: realm.provider, uid: token, credentials: token };
  }
}
