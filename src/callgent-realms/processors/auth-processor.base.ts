import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ServerObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { EntryDto } from '../../entries/dto/entry.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { Optional } from '../../infras/libs/utils';
import { RealmSchemeVO } from '../dto/realm-scheme.vo';
import { RealmSecurityItem } from '../dto/realm-security.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';

export abstract class AuthProcessor {
  /**
   * fill in necessary realm properties
   * @param entry
   */
  constructRealm(
    _scheme: Optional<RealmSchemeVO, 'validationUrl'>,
    realm: Partial<CallgentRealm>,
    entry?: EntryDto,
    servers?: ServerObject[],
  ): CallgentRealm {
    // imply provider, always not be empty
    realm.provider = this.implyProvider(_scheme, entry, servers);
    if (!_scheme.validationUrl) {
      if (entry?.type === 'CLIENT')
        throw new BadRequestException('scheme.validationUrl is required');
      _scheme.validationUrl = realm.provider;
    }
    const scheme = _scheme as RealmSchemeVO;
    realm.perUser = this.isPerUser(scheme, realm);
    realm.enabled = this.checkEnabled(scheme, realm);

    realm.realmKey = this.getRealmKey({ ...realm, scheme });
    return realm as CallgentRealm;
  }

  /** construct a security guard on entry/ep */
  constructSecurity(
    entry: EntryDto,
    realm: CallgentRealm,
    scopes?: string[],
  ): RealmSecurityItem {
    let attach: boolean;
    if (entry.type !== 'CLIENT') {
      try {
        // imply from entry only, if same with realm provider, then attach
        const provider = this.implyProvider({ validationUrl: null }, entry);
        attach = provider === realm.provider;
      } catch (e) {
        // ignore
      }
    }
    return { realmId: realm.id, attach, scopes };
  }

  /**
   * imply auth service provider from scheme/entry/server sequentially
   * @returns provider hostname, must not be empty
   * @throws Error if fail to imply
   */
  protected implyProvider(
    scheme: Optional<RealmSchemeVO, 'validationUrl'>,
    entry?: EntryDto,
    servers?: { url: string }[],
  ) {
    let url: string =
      scheme.validationUrl ||
      (entry && entry.type != 'CLIENT' && entry.host) ||
      servers?.find((server) => {
        try {
          server.url && new URL(server.url);
          return true;
        } catch (e) {}
      })?.url;
    if (!url) throw new BadRequestException('Cannot imply security provider.');

    try {
      return new URL(url).hostname;
    } catch (e) {
      try {
        return new URL('http://' + url).hostname;
      } catch (e) {
        throw new BadRequestException(
          'Cannot imply security provider from ' + url,
        );
      }
    }
  }

  /** @returns realm key to identify the same realms */
  protected getRealmKey(realm: Partial<CallgentRealm>): string {
    const keys = this._getRealmKeys(realm);
    return keys.join(':');
  }
  protected abstract _getRealmKeys(realm: Partial<CallgentRealm>): string[];

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
   * @returns {{ data: event; resumeFunName?: 'postValidateToken' }} if valid/or async
   * @throws Error if not valid
   */
  async validateToken(
    token: string,
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<{
    data: ClientRequestEvent;
    resumeFunName?: 'postValidateToken';
  }> {
    const security: RealmSecurityItem = reqEvent.context.securityItem;

    // true valid/attached, false invalid, else async
    let result: boolean | void = false;

    if (security?.attach)
      result = await this._attachToken(token, reqEvent, realm);
    else if (realm.scheme.validationUrl)
      result = await this._validateTokenByUrl(token, realm);

    if (result === false)
      throw new UnauthorizedException(
        'Cannot validate auth token, validationUrl must not empty. callgentId=' +
          realm.callgentId,
      );

    return result
      ? { data: reqEvent } // valid/attached token
      : { data: reqEvent, resumeFunName: 'postValidateToken' }; // async
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
   * @returns valid/async
   * @throws Error if auth failed
   */
  abstract authProcess(
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
