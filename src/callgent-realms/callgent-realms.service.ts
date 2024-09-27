import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ServerObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Prisma, PrismaClient } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { ClientRequestEvent } from '../endpoints/events/client-request.event';
import { selectHelper } from '../infra/repo/select.helper';
import { UsersService } from '../users/users.service';
import { RealmSchemeVO } from './dto/realm-scheme.vo';
import { RealmSecurityItem, RealmSecurityVO } from './dto/realm-security.vo';
import { UpdateCallgentRealmDto } from './dto/update-callgent-realm.dto';
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
    pk: false,
    tenantPk: false,
    createdAt: false,
    updatedAt: false,
    deletedAt: false,
  };

  //// auth config start ////

  @Transactional()
  async create(
    realm: Omit<Prisma.CallgentRealmUncheckedCreateInput, 'realmKey'> & {
      realmKey?: string;
    },
    select?: Prisma.CallgentRealmSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const processor = this._getAuthProcessor(realm.authType);
    realm = processor.constructRealm(realm.scheme as any, realm as any) as any;
    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.create({
          data: { ...(realm as any), pk: undefined },
          select,
        }),
      this.defSelect,
    );
  }

  /**
   * try to map to existing realm. FIXME: update securities when realm changed
   */
  @Transactional()
  async upsertRealm(
    endpoint: EndpointDto,
    scheme: Omit<RealmSchemeVO, 'provider'> & { provider?: string },
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
    servers: ServerObject[],
  ) {
    const authType = scheme.type;
    const processor = this._getAuthProcessor(authType);
    realm = processor.constructRealm(scheme, realm, endpoint, servers);
    const realmKey = realm.realmKey;
    const callgentId = endpoint.callgentId;
    const prisma = this.txHost.tx as PrismaClient;

    const existing = await prisma.callgentRealm.findFirst({
      select: { pk: true },
      where: { OR: [{ callgentId, realmKey }, { pk: realm.pk }] },
    });
    if (existing)
      return prisma.callgentRealm.update({
        where: { pk: existing.pk },
        data: {
          ...realm,
          authType,
          realmKey,
          scheme: scheme as any,
        },
      });

    return prisma.callgentRealm.create({
      data: {
        ...realm,
        callgentId,
        realmKey,
        authType,
        scheme: scheme as any,
      },
    });
  }

  /** construct security guard on endpoint */
  constructSecurity(realm: CallgentRealm, endpoint: EndpointDto) {
    const processor = this._getAuthProcessor(realm.authType);
    return processor.constructSecurity(endpoint, realm);
  }

  //// auth check start, auth config end ////

  /** same as sep auth, except token cannot be attached to request event */
  async checkCepAuth(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const cep = await this.endpointsService.findOne(reqEvent.srcId);
    if (!cep)
      throw new NotFoundException(
        'Client endpoint not found, id: ' + reqEvent.srcId,
      );

    return this.checkSecurities(reqEvent, cep.securities as any);
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
    return this.checkSecurities(reqEvent, securities, true);
  }

  /**
   * @returns false if check fail
   */
  async checkSecurities(
    reqEvent: ClientRequestEvent,
    securities: RealmSecurityVO[],
    sep = false,
  ) {
    if (!securities?.length) return; // no auth, check ok

    for (const security of securities) {
      reqEvent.context.security = security;
      const result = await this._checkSecurity(reqEvent);
      if (result) return result; // check ok
    }

    // check auth failed
    throw new UnauthorizedException(
      `Check ${sep ? 'SEP' : 'CEP'} authentications failed.`,
    );
  }

  /**
   *
   * @returns false if check fail, else { data, resumeFunName? }
   */
  @Transactional()
  protected async _checkSecurity(
    reqEvent: ClientRequestEvent,
  ): Promise<false | { data: ClientRequestEvent; resumeFunName?: string }> {
    const security: RealmSecurityVO = reqEvent.context.security;
    const items = Object.values(security);

    // FIXME persist-async for items list, by adding index into req.ctx
    // for (const item of items) {
    //   const result = await this._checkAuth(item, reqEvent);
    //   if (!result) return result; // any check fail
    // }

    return this._checkSecurityItem(items[0], reqEvent);
  }

  protected async _checkSecurityItem(
    item: RealmSecurityItem,
    reqEvent: ClientRequestEvent,
  ) {
    reqEvent.context.securityItem = item;
    const { realm, processor } = await this._loadRealm(item, true);
    // return false if disabled
    if (!realm?.enabled) return false;

    // read existing from token store
    const userToken = await this.findUserToken(realm, reqEvent.data.callerId);
    if (userToken) {
      // invoke validation url. TODO security as arg
      const result = await processor.validateToken(
        userToken.credentials,
        reqEvent,
        realm,
      );
      if (result) return result; // valid/attach or async
      // else invalid, continue to refresh token process
    }

    // if not valid, start auth process
    const ret = await processor.authProcess(realm, item, reqEvent);
    if (ret) return ret; // async

    // self provider same as third
    return this.postAuthProcess(reqEvent);
  }

  /** delegate to auth processor  */
  async postAcquireSecret(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const item: RealmSecurityItem = reqEvent.context.securityItem;
    const { realm, processor } = await this._loadRealm(item);
    return processor.postAcquireSecret(reqEvent, realm);
  }

  /** delegate to auth processor  */
  async postExchangeToken(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const item: RealmSecurityItem = reqEvent.context.securityItem;
    const { realm, processor } = await this._loadRealm(item);
    return processor.postExchangeToken(reqEvent, realm);
  }

  /**
   * delegate to auth processor,
   * if valid, goon, if not start process, if unsure re-validate
   */
  async postValidateToken(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const item: RealmSecurityItem = reqEvent.context.securityItem;
    const { realm, processor } = await this._loadRealm(item);
    return processor.postValidateToken(reqEvent, realm);
  }

  /**
   * @param noError if false, throw error if realm not enabled
   */
  protected async _loadRealm(security: RealmSecurityItem, noError = false) {
    const realm = await this._findOne(security.realmPk, { pk: null });
    if (!realm?.enabled) {
      if (noError) return { realm };
      throw new UnauthorizedException(
        'Invalid security realm ' + security.realmPk,
      );
    }
    const processor = this._getAuthProcessor(realm.authType);
    return { realm, processor };
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

  /**
   * @param authType @see AuthType
   */
  protected _getAuthProcessor(authType: string): AuthProcessor {
    return this.moduleRef.get(authType + '-authProcessor');
  }

  @Transactional()
  protected _findOne(pk: number, select?: Prisma.CallgentRealmSelect) {
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

  @Transactional()
  findOne(
    callgentId: string,
    realmKey: string,
    select?: Prisma.CallgentRealmSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.findUnique({
          select,
          where: { callgentId_realmKey: { callgentId, realmKey } },
        }),
      this.defSelect,
    ) as unknown as Promise<CallgentRealm>;
  }

  @Transactional()
  findAll({
    select,
    where,
    orderBy = { pk: 'desc' },
  }: {
    select?: Prisma.CallgentRealmSelect;
    where?: Prisma.CallgentRealmWhereInput;
    orderBy?: Prisma.CallgentRealmOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.findMany({
          where,
          select,
          orderBy,
        }),
      this.defSelect,
    );
  }

  /**
   * update realm, refresh { realmKey, enabled }
   */
  @Transactional()
  async update(
    callgentId: string,
    realmKey: string,
    dto: UpdateCallgentRealmDto,
    select?: Prisma.CallgentRealmSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const old = await this.findOne(callgentId, realmKey);
    dto = { ...old, ...dto }; // merge
    if (!dto.scheme) throw new BadRequestException('realm.scheme is required');

    dto.authType = dto.scheme.type;
    const processor = this._getAuthProcessor(dto.authType);
    dto = processor.constructRealm(dto.scheme, dto as any);

    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.update({
          select,
          where: { callgentId_realmKey: { callgentId, realmKey } },
          data: { ...dto, scheme: dto.scheme as any },
        }),
      this.defSelect,
    );
  }
}
