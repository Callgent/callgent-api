import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma, PrismaClient } from '@prisma/client';
import { EndpointsService } from '../endpoints/endpoints.service';
import { ClientRequestEvent } from '../endpoints/events/client-request.event';
import { selectHelper } from '../infra/repo/select.helper';
import { UsersService } from '../users/users.service';
import { CallgentRealm } from './entities/callgent-realm.entity';
import { AuthProcessor } from './processors/auth-processor.base';

/** each callgent may have several security realms */
@Injectable()
export class CallgentRealmsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
    private readonly usersService: UsersService,
    private readonly moduleRef: ModuleRef,
  ) {}
  protected readonly defSelect: Prisma.CallgentRealmSelect = {
    createdAt: false,
    updatedAt: false,
    deletedAt: false,
  };

  /** same as sep auth, except token cannot be attached to request event */
  async checkCepAuth(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const cep = await this.endpointsService.findOne(reqEvent.srcId);
    if (!cep)
      throw new NotFoundException(
        'Client endpoint not found, id: ' + reqEvent.srcId,
      );

    return this.checkAuths(reqEvent, cep.securities as any);
  }

  /**
   * check auth on the chosen callgent function.
   * automatically starts auth process to retrieve token.
   * may callback to cep for user credentials.
   */
  async checkSepAuth(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    // functions: CallgentFunction[], @see AgentsService.map2Function
    const { securities, endpointId: sepId } =
      reqEvent.context.functions?.length && reqEvent.context.functions[0];

    const sep = sepId && (await this.endpointsService.findOne(reqEvent.srcId));
    if (!sep)
      throw new NotFoundException(
        'Server endpoint not found, id: ' + reqEvent.srcId,
      );
    return this.checkAuths(reqEvent, securities, true);
  }

  /**
   * @returns false if check fail
   */
  async checkAuths(
    reqEvent: ClientRequestEvent,
    securities: { [realmPk: number]: string[] },
    sep = false,
  ) {
    const entries = securities && Object.entries(securities);
    if (!entries?.length) return; // no auth, check ok

    for (const security of entries) {
      reqEvent.context.security = security;
      const result = await this._checkAuth(reqEvent);
      if (result) return result;
    }

    // check auth failed
    throw new UnauthorizedException(
      `Check ${sep ? 'SEP' : 'CEP'} authentications failed.`,
    );
  }

  /** @returns false if check fail, else { data, resumeFunName? } */
  @Transactional()
  protected async _checkAuth(
    reqEvent: ClientRequestEvent,
  ): Promise<false | { data: ClientRequestEvent; resumeFunName?: string }> {
    const security = reqEvent.context.security;
    // load callgent realm config
    const realm = await this.findOne(security[0]);
    // return false if disabled
    if (!realm?.enabled) return false;

    const processor = this._getAuthProcessor(realm.authType);

    // read existing from token store
    const token = await this.findUserToken(realm, reqEvent.data.callerId);
    if (token) {
      // invoke validation url. TODO security as arg
      const result = await processor.validateToken(token, reqEvent, realm);
      if (result) return { data: reqEvent }; // valid/attached token
      // async
      if (result !== false)
        return { data: reqEvent, resumeFunName: 'postValidateToken' };
      // else invalid, continue to refresh token process
    }

    // if not valid, start auth process
    const ret = await processor.authProcess(reqEvent, realm);
    if (ret) return ret; // async

    // self provider same as third
    return this.postAuthProcess(reqEvent);
  }

  /** if valid, goon, if not start process, if unsure re-validate */
  async postValidateToken(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {}

  /** delegate to auth processor  */
  async postAcquireSecret(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const security = reqEvent.context.security;
    const realm = await this.findOne(security[0], {});
    const processor = this._getAuthProcessor(realm.authType);
    return processor.postAcquireSecret(reqEvent, realm);
  }

  /** delegate to auth processor  */
  async postExchangeToken(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const security = reqEvent.context.security;
    const realm = await this.findOne(security[0], {});
    const processor = this._getAuthProcessor(realm.authType);
    return processor.postExchangeToken(reqEvent, realm);
  }

  /**
   * after auth process
   * @returns false if check fail(no error, go on to next check), else { data, resumeFunName? }
   */
  async postAuthProcess(
    reqEvent: ClientRequestEvent,
  ): Promise<false | { data: ClientRequestEvent; resumeFunName?: string }> {
    // store new token/or bind to existing, better auto login the user
    // attach to req if needed

    return false;
  }

  findUserToken(realm: CallgentRealm, userId: string) {
    if (userId && realm.scheme?.perUser)
      return this.usersService.$findFirstUserIdentity(userId, '' + realm.pk);
  }

  findOne(pk: number, select?: Prisma.CallgentRealmSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.findUnique({
          select,
          where: { pk },
        }),
      this.defSelect,
    ) as unknown as Promise<CallgentRealm>;
  }

  /**
   * @param authType @see AuthType
   */
  protected _getAuthProcessor(authType: string): AuthProcessor {
    return this.moduleRef.get(authType + '-authProcessor');
  }
}
