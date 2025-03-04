import { UnauthorizedException } from '@nestjs/common';
import {
  SecuritySchemeObject,
  ServerObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { EntryDto } from '../../entries/dto/entry.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { AuthType, RealmSchemeVO } from '../dto/realm-scheme.vo';
import { RealmSecurityItem } from '../dto/realm-security.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';

export abstract class AuthProcessor {
  /** fill in necessary realm properties */
  constructRealm(
    scheme: Omit<RealmSchemeVO, 'provider'> & { provider?: string },
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
    entry?: EntryDto,
    servers?: ServerObject[],
  ) {
    // imply provider
    scheme.provider = this.implyProvider(scheme, entry, servers);
    realm.realmKey = this.getRealmKey(scheme as any, realm.realm);
    realm.perUser = this.isPerUser(scheme as any, realm);
    realm.enabled = this.checkEnabled(scheme as any, realm);

    return realm;
  }

  /** construct a security guard on entry */
  constructSecurity(
    entry: EntryDto,
    realm: CallgentRealm,
    scopes?: string[],
  ): RealmSecurityItem {
    let attach: boolean;
    if (entry.type != 'CLIENT') {
      try {
        const provider = this.implyProvider(
          { ...realm.scheme, provider: undefined } as any,
          entry,
        );
        if (provider == realm.scheme.provider) attach = true;
      } catch (e) {
        // ignore
      }
    }
    return { realmPk: realm.pk, attach, scopes };
  }

  /**
   * imply auth service provider
   * @returns provider domain, must not be empty
   * @throws Error if fail to imply
   */
  protected abstract implyProvider(
    scheme: Omit<SecuritySchemeObject, 'type'> & { type: AuthType },
    entry?: EntryDto,
    servers?: { url: string }[],
  ): string;

  /** @returns realm key to identify the same realms */
  protected abstract getRealmKey(scheme: RealmSchemeVO, realm?: string): string;

  protected abstract checkEnabled(
    scheme: RealmSchemeVO,
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
  ): boolean;

  protected abstract validateSecretFormat(
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
    scheme: RealmSchemeVO,
  ): boolean;

  protected abstract isPerUser(
    scheme: RealmSchemeVO,
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
  ): boolean;

  /**
   * validate auth token.
   * this may be persistent-async
   * @returns void if invalid; { data: event; resumeFunName?: 'postValidateToken' } if valid/or async
   * @throws Error if not allowed to attach and validationUrl empty
   */
  async validateToken(
    token: string,
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | {
    data: ClientRequestEvent;
    resumeFunName?: 'postValidateToken';
  }> {
    const security: RealmSecurityItem = reqEvent.context.securityItem;

    // true valid/attached, false invalid, else async
    let result: boolean | void;

    if (security?.attach)
      result = await this._attachToken(token, reqEvent, realm);
    else if (realm.scheme.validationUrl)
      result = await this._validateTokenByUrl(token, realm);
    else
      throw new UnauthorizedException(
        'Cannot validate auth token, validationUrl must not empty. callgentId=' +
          realm.callgentId,
      );

    if (result) return { data: reqEvent }; // valid/attached token
    // void, async
    if (result !== false)
      return { data: reqEvent, resumeFunName: 'postValidateToken' };
    // else invalid, continue to refresh token process
  }

  /**
   * start to exchange secret to token from provider
   * @returns secret string
   */
  abstract postValidateToken(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }>;

  /**
   * validate token from realm.scheme.validationUrl
   * @returns boolean if valid/invalid, void if async
   */
  protected abstract _validateTokenByUrl(
    token: string,
    realm: CallgentRealm,
  ): Promise<boolean | void>;

  /**
   * attach token to request
   * @returns true if attached
   * @throws Error if not allowed to attach
   */
  abstract _attachToken(
    token: string,
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<true>;

  /** any async invocation callback from auth provider */
  abstract providerCallback(): Promise<void>;

  /**
   * common steps for auth process:
   * 1. [request client, redirect to provider, try acquire secret]
   * 2. acquire secret from caller, [may async]
   * 3. send secret to provider, to exchange token
   * 4. [redirect back to client to get provider token, then send token to caller]
   * 5. [attach token to req if needed]
   * @returns void or { data } if done; {data: reqEvent, resumeFunName?: 'postAcquireSecret' | 'postExchangeToken'} if async, CallgentRealmsService will call resumeFunName which delegate to current processor
   */
  abstract authProcess(
    realm: CallgentRealm,
    item: RealmSecurityItem,
    reqEvent: ClientRequestEvent,
  ): Promise<void | {
    data: ClientRequestEvent;
    resumeFunName?:
      | 'postAcquireSecret'
      | 'postExchangeToken'
      | 'postAuthCheck'
      | 'postValidateToken';
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

  abstract getIdentity(
    req: any,
    realm: CallgentRealm,
  ): {
    provider: string;
    uid: string;
    credentials: string;
  };
}
