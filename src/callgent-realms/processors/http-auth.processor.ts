import { Injectable } from '@nestjs/common';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { APIKeySecurityScheme, RealmSchemeVO } from '../dto/realm-scheme.vo';
import { RealmSecurityItem } from '../dto/realm-security.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';
import { AuthProcessor } from './auth-processor.base';

@Injectable()
export class HttpAuthProcessor extends AuthProcessor {
  /** @returns http:provider:scheme:realm */
  protected _getRealmKeys(realm: Partial<CallgentRealm>) {
    return [
      realm.authType,
      realm.provider,
      realm.scheme?.scheme,
      realm.realm,
    ].filter((s) => s);
  }

  protected checkEnabled(
    scheme: RealmSchemeVO,
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
  ) {
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
  ): Promise<{
    data: ClientRequestEvent;
    resumeFunName?: 'postValidateToken';
  }> {
    return this.validateToken(
      // item configured token first
      item.secret || userIdentity.credentials,
      reqEvent,
      realm,
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
    // {"type":"apiKey","in":"header","name":"x-callgent-authorization","provider":"api.callgent.com"}
    const scheme: APIKeySecurityScheme = realm.scheme as any;
    const req = reqEvent.context.req;

    const [name, value] = [scheme.name, realm.secret as string];
    let in0 = scheme.in;
    switch (in0) {
      case 'cookie':
        if (!req.headers) req.headers = {};
        req.headers.cookie = `${req.headers.cookie || ''}${
          req.headers.cookie ? ';' : ''
        }${name}=${encodeURIComponent(value)}`;
        break;
      case 'header':
        in0 += 's';
      case 'query':
        if (!req[in0]) req[in0] = {};
        req[in0][name] = realm.secret;
        break;
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
    throw new Error('Method not implemented.');
  }
}
