import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SecuritySchemeObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../endpoints/events/client-request.event';
import { APIKeySecurityScheme, RealmSchemeVO } from '../dto/realm-scheme.vo';
import { RealmSecurityItem } from '../dto/realm-security.vo';
import { CallgentRealm } from '../entities/callgent-realm.entity';
import { AuthProcessor } from './auth-processor.base';

@Injectable()
export class ApiKeyAuthProcessor extends AuthProcessor {
  protected implyProvider(
    scheme: SecuritySchemeObject,
    endpoint?: EndpointDto,
    servers?: { url: string }[],
  ) {
    let url: string = (scheme as any).provider;
    if (url) {
      if (!url.toLowerCase().startsWith('http')) url = 'http://' + url;
    } else {
      if (endpoint && endpoint.type != 'CLIENT') {
        url = endpoint.host; // whatever adaptor it is, host need to be a url
      } else if (servers?.length > 0) {
        url = servers[0].url;
      }
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
    return `apiKey:${scheme.in || ''}:${scheme.name || ''}:${scheme.provider}:${
      realm || ''
    }`;
  }

  protected checkEnabled(
    scheme: RealmSchemeVO,
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
  ) {
    if (!realm.secret || !scheme.provider || !scheme.name || !scheme.in)
      return false;
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
    // {"type":"apiKey","in":"header","name":"x-callgent-authorization","provider":"api.callgent.com"}
    const scheme: APIKeySecurityScheme = realm.scheme as any;
    const req = reqEvent.context.req as any;

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
}
