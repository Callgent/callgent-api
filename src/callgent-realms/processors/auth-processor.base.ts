import { SecuritySchemeType } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { EventObject } from '../../event-listeners/event-object';
import { UserIdentity } from '../../user-identities/entities/user-identity.entity';
import { CallgentRealm } from '../entities/callgent-realm.entity';
import { ClientRequestEvent } from '../../endpoints/events/client-request.event';

export type AuthType = SecuritySchemeType; // | '';

export abstract class AuthProcessor {
  /**
   * validate token via realm.scheme.validationUrl; if url empty, just attach token to req if allowed.
   * this may be persistent-async
   * @returns true if valid/attached, false invalid, void if async
   */
  async validateToken(
    token: UserIdentity,
    reqEvent: EventObject,
    realm: CallgentRealm,
  ): Promise<void | boolean> {
    if (realm.scheme.validationUrl) return this._validateToken(token, realm);

    return this._attachToken(token, reqEvent, realm);
  }

  /**
   * @returns boolean if valid/invalid, void if async
   */
  abstract _validateToken(
    token: UserIdentity,
    realm: CallgentRealm,
  ): Promise<boolean | void>;

  /**
   * attach token to request, independent of sep?
   * @returns true if attached
   * @throws Error if not allowed to attach
   */
  abstract _attachToken(
    token: UserIdentity,
    reqEvent: EventObject,
    realm: CallgentRealm,
  ): Promise<true>;

  /** any async invocation callback from auth provider */
  abstract providerCallback(): Promise<void>;

  /**
   * common steps for auth process:
   * 1. [request client, redirect to provider, acquire secret]
   * 2. acquire secret from caller, [may async]
   * 3. send secret to provider, to exchange token
   * 4. [redirect back to client to get provider token, then send token to caller]
   * @returns void if done; {data: reqEvent, resumeFunName?: 'postAcquireSecret' | 'postExchangeToken'} if async, CallgentRealmsService will call resumeFunName which delegate to current processor
   */
  abstract authProcess(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | {
    data: ClientRequestEvent;
    resumeFunName?: 'postAcquireSecret' | 'postExchangeToken' | 'postAuthCheck';
  }>;

  /**
   * start to exchange secret to token from provider
   * @returns secret string
   */
  abstract postAcquireSecret(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }>;

  /** extract, store and use the token */
  abstract postExchangeToken(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }>;
}
