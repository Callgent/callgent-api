import { BadRequestException, Injectable } from '@nestjs/common';
import { SecuritySchemeObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../endpoints/events/client-request.event';
import { EventObject } from '../../event-listeners/event-object';
import { UserIdentity } from '../../user-identities/entities/user-identity.entity';
import { RealmSchemeVO } from '../dto/realm-scheme.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';
import { AuthProcessor } from './auth-processor.base';

@Injectable()
export class ApiKeyAuthProcessor extends AuthProcessor {
  protected implyProvider(
    scheme: SecuritySchemeObject,
    endpoint?: EndpointDto,
    servers?: { url: string }[],
  ) {
    let url: string;
    if (endpoint && endpoint.type != 'CLIENT') {
      url = endpoint.host; // whatever adaptor it is, host need to be a url
    } else if (servers?.length > 0) {
      url = servers[0].url;
    }
    if (!url)
      throw new BadRequestException(
        'Cannot imply security provider, please specify it manually',
      );

    try {
      return new URL(url).hostname;
    } catch (e) {
      throw new BadRequestException(
        'Invalid security provider, must be url: ' + url,
      );
    }
  }

  /** @returns ApiKey:in:name:provider:realm */
  protected getRealmKey(scheme: RealmSchemeVO, realm?: string) {
    return `${scheme.type}:${scheme.in || ''}:${scheme.name || ''}:${
      scheme.provider
    }:${realm || ''}`;
  }

  protected checkEnabled(
    scheme: RealmSchemeVO,
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
  ) {
    if (!realm.secret || !scheme.provider) return false;
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

  _validateToken(
    token: UserIdentity,
    realm: CallgentRealm,
  ): Promise<boolean | void> {
    throw new Error('Method not implemented.');
  }

  _attachToken(
    token: UserIdentity,
    reqEvent: EventObject,
    realm: CallgentRealm,
  ): Promise<true> {
    throw new Error('Method not implemented.');
  }

  providerCallback(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  authProcess(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | {
    data: ClientRequestEvent;
    resumeFunName?: 'postAcquireSecret' | 'postExchangeToken' | 'postAuthCheck';
  }> {
    throw new Error('Method not implemented.');
  }

  postAcquireSecret(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    throw new Error('Method not implemented.');
  }

  postExchangeToken(
    reqEvent: ClientRequestEvent,
    realm: CallgentRealm,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    throw new Error('Method not implemented.');
  }
}
