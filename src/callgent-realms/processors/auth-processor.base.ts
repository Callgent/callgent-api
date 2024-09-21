import { UnauthorizedException } from '@nestjs/common';
import {
  SecuritySchemeObject,
  ServerObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../endpoints/events/client-request.event';
import { EventObject } from '../../event-listeners/event-object';
import { UserIdentity } from '../../user-identities/entities/user-identity.entity';
import { CallgentRealmDto } from '../dto/callgent-realm.dto';
import { AuthType, RealmSchemeVO } from '../dto/realm-scheme.vo';
import { RealmSecurityVO } from '../dto/realm-security.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';

export abstract class AuthProcessor {
  /** fill in necessary realm properties */
  constructRealm(
    endpoint: EndpointDto,
    scheme: Omit<RealmSchemeVO, 'provider'> & { provider?: string },
    realm: Partial<Omit<CallgentRealmDto, 'scheme'>>,
    servers?: ServerObject[],
  ) {
    // imply provider
    if (!scheme.provider)
      scheme.provider = this.implyProvider(scheme, endpoint, servers);
    realm.realmKey = this.getRealmKey(scheme as any, realm.realm);
    realm.perUser = this.isPerUser(scheme as any, realm);
    realm.enabled = this.checkEnabled(scheme as any, realm);

    return realm;
  }

  /** construct a security guard on endpoint */
  constructSecurity(endpoint: EndpointDto, realm: CallgentRealm) {
    let attach: boolean;
    if (endpoint.type != 'CLIENT') {
      try {
        const provider = this.implyProvider(realm.scheme, endpoint);
        if (provider == realm.scheme.provider) attach = true;
      } catch (e) {
        // ignore
      }
    }
    return { realmPk: realm.pk, attach };
  }

  /**
   * imply auth service provider
   * @returns provider domain, must not be empty
   * @throws Error if fail to imply
   */
  protected abstract implyProvider(
    scheme: Omit<SecuritySchemeObject, 'type'> & { type: AuthType },
    endpoint: EndpointDto,
    servers?: { url: string }[],
  ): string;

  /** @returns realm key to identify the same realms */
  protected abstract getRealmKey(scheme: RealmSchemeVO, realm?: string): string;

  protected abstract checkEnabled(
    scheme: RealmSchemeVO,
    realm: Partial<Omit<CallgentRealmDto, 'scheme'>>,
  ): boolean;

  protected abstract isPerUser(
    scheme: RealmSchemeVO,
    realm: Partial<Omit<CallgentRealmDto, 'scheme'>>,
  ): boolean;

  /**
   * validate auth token
   * this may be persistent-async
   * @returns true if valid/attached, false invalid, void if async
   * @throws Error if not allowed to attach and validationUrl empty
   */
  async validateToken(
    token: UserIdentity,
    reqEvent: EventObject,
    realm: CallgentRealm,
  ): Promise<void | boolean> {
    const security: RealmSecurityVO = reqEvent.context.security;

    if (security?.attach) return this._attachToken(token, reqEvent, realm);
    if (realm.scheme.validationUrl) return this._validateToken(token, realm);
    throw new UnauthorizedException(
      'Cannot validate auth token, validationUrl must not empty.',
    );
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
