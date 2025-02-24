import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ServerObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Prisma, PrismaClient } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { Endpoint } from '../endpoints/entities/endpoint.entity';
import { EntryDto } from '../entries/dto/entry.dto';
import { EntriesService } from '../entries/entries.service';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { selectHelper } from '../infras/repo/select.helper';
import { UsersService } from '../users/users.service';
import { RealmSchemeVO } from './dto/realm-scheme.vo';
import {
  RealmSecurityItem,
  RealmSecurityItemForm,
  RealmSecurityVO,
} from './dto/realm-security.vo';
import { UpdateCallgentRealmDto } from './dto/update-callgent-realm.dto';
import { CallgentRealm } from './entities/callgent-realm.entity';
import { AuthProcessor } from './processors/auth-processor.base';

/** each callgent may have several security realms */
@Injectable()
export class CallgentRealmsService implements OnModuleInit {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    private readonly usersService: UsersService,
    private readonly moduleRef: ModuleRef,
  ) {}
  protected readonly defSelect: Prisma.CallgentRealmSelect = {
    pk: false,
    tenantPk: false,
    createdAt: false,
    updatedAt: false,
  };

  private endpointsService: EndpointsService;
  onModuleInit() {
    // a little hack: circular relation
    this.endpointsService = this.moduleRef.get('EndpointsService', {
      strict: false,
    });
  }

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
   * try to map to existing realm. FIXME: update securities when realm changed, see this.delete
   */
  @Transactional()
  async upsertRealm(
    entry: EntryDto,
    scheme: Omit<RealmSchemeVO, 'provider'> & { provider?: string },
    realm: Partial<Omit<CallgentRealm, 'scheme'>>,
    servers: ServerObject[],
  ) {
    const authType = scheme.type;
    const processor = this._getAuthProcessor(authType);
    realm = processor.constructRealm(scheme, realm, entry, servers);
    const realmKey = realm.realmKey;
    const callgentId = entry.callgentId;
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

  /** construct security guard on entry */
  constructSecurity(realm: CallgentRealm, entry: EntryDto, scopes?: string[]) {
    const processor = this._getAuthProcessor(realm.authType);
    return processor.constructSecurity(entry, realm, scopes);
  }

  // TODO: RealmSecurityVO
  async updateSecurities(
    type: 'entry' | 'function',
    id: string,
    securities: RealmSecurityItemForm[],
  ) {
    let entry, targetService: EntriesService | EndpointsService;
    if (type == 'entry') {
      targetService = this.entriesService;
      entry = await this.entriesService.findOne(id);
    } else {
      targetService = this.endpointsService;
      const fun = await this.endpointsService.findOne(id, {
        entryId: true,
      });
      entry = fun && (await this.entriesService.findOne(fun.entryId));
    }
    if (!entry) throw new NotFoundException('Not found ' + type);

    const secs = await Promise.all(
      securities.map(async (security) => {
        const realm = await this.findOne(entry.callgentId, security.realmKey, {
          pk: null,
        });
        if (!realm) throw new NotFoundException('Not found realm');

        const sec = this.constructSecurity(realm, entry, security.scopes);
        return { ['' + sec.realmPk]: sec };
      }),
    );

    return targetService.updateSecurities(id, secs).then((e) => !!e);
  }

  //// auth check start, auth config end ////

  /** same as sep auth, except token cannot be attached to request event */
  async checkCenAuth(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const cep = await this.entriesService.findOne(reqEvent.srcId);
    if (!cep)
      throw new NotFoundException(
        'Client entry not found, id: ' + reqEvent.srcId,
      );

    return this.checkSecurities(reqEvent, cep.securities as any);
  }

  /**
   * check auth on the chosen endpoints.
   * automatically starts auth process to retrieve token.
   * may callback to cep for user credentials.
   */
  async checkSepAuth(
    endpoint: EndpointDto,
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const result = await this.checkSecurities(
      reqEvent,
      (endpoint as Endpoint).securities,
      true,
    );
    if (result) return result; // FIXME: resume after post auth action

    const sen = await this.entriesService.findOne(endpoint.entryId);
    return this.checkSecurities(reqEvent, sen.securities as any, true);
  }

  /**
   * @throws UnauthorizedException if check fail, else ok
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
    // delete reqEvent.context.security;

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
    const userToken = await this.findUserToken(
      realm,
      reqEvent.context.callerId,
    );
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

  @Transactional()
  async delete(callgentId: string, realmKey: string) {
    const prisma = this.txHost.tx as PrismaClient;
    const realm = await prisma.callgentRealm.delete({
      where: { callgentId_realmKey: { callgentId, realmKey } },
    });
    if (!realm) return;
    const pk = realm.pk + '';

    // clear securities
    await Promise.all([
      prisma.$executeRaw`UPDATE "Entry"
    SET "securities" = (
        SELECT array_agg(sec::jsonb - ${pk})
          FILTER (WHERE (sec::jsonb - ${pk})::text != '{}')
        FROM unnest("securities") AS sec
    )
    WHERE "callgentId"=${callgentId} and EXISTS (
        SELECT 1
        FROM unnest("securities") AS elem
        WHERE elem::jsonb ? ${pk}
    )`,
      prisma.$executeRaw`UPDATE "Endpoint"
    SET "securities" = (
        SELECT array_agg(sec::jsonb - ${pk})
          FILTER (WHERE (sec::jsonb - ${pk})::text != '{}')
        FROM unnest("securities") AS sec
    )
    WHERE "callgentId"=${callgentId} and EXISTS (
        SELECT 1
        FROM unnest("securities") AS elem
        WHERE elem::jsonb ? ${pk}
    )`,
    ]);

    delete realm.pk;
    delete realm.tenantPk;
    realm.secret = !!realm.secret;
    return realm;
  }
}
