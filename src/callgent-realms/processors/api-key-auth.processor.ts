import { Injectable } from '@nestjs/common';
import { ClientRequestEvent } from '../../endpoints/events/client-request.event';
import { EventObject } from '../../event-listeners/event-object';
import { UserIdentity } from '../../user-identities/entities/user-identity.entity';
import { CallgentRealm } from '../entities/callgent-realm.entity';
import { AuthProcessor } from './auth-processor.base';

@Injectable()
export class ApiKeyAuthProcessor extends AuthProcessor {
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
