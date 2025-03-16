import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServerObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Prisma, PrismaClient } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { Endpoint } from '../endpoints/entities/endpoint.entity';
import { EntryDto } from '../entries/dto/entry.dto';
import { EntriesService } from '../entries/entries.service';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { Optional, Utils } from '../infras/libs/utils';
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
import { PostAuthEvent } from './events/post-auth.event';
import { AuthProcessor } from './processors/auth-processor.base';
import { AbacContextService } from '../infras/repo/abac/prisma-abac.service';

/** each callgent may have several security realms */
@Injectable()
export class CallgentRealmsService implements OnModuleInit {
  private readonly logger = new Logger(CallgentRealmsService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    private readonly usersService: UsersService,
    private readonly moduleRef: ModuleRef,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenancyService: AbacContextService,
  ) {}
  protected readonly defSelect: Prisma.CallgentRealmSelect = {
    pk: false,
    secret: false,
    tenantPk_: false,
    createdAt: false,
    updatedAt: false,
    deletedAt: false,
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
    realm: Omit<
      Prisma.CallgentRealmUncheckedCreateInput,
      'id' | 'realmKey' | 'provider'
    >,
    select?: Prisma.CallgentRealmSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const processor = this._getAuthProcessor(realm.authType);
    const data = processor.constructRealm(realm.scheme as any, realm as any);
    data.id = Utils.uuid();
    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.create({
          data: { ...(data as any), pk: undefined, tenantPk_: undefined },
          select,
        }),
      this.defSelect,
    );
  }

  /**
   * try to map to existing realm.
   * @param scheme if validationUrl is not provided, it will be set to implied provider
   */
  @Transactional()
  async upsertRealm(
    entry: EntryDto,
    scheme: Optional<RealmSchemeVO, 'validationUrl'>,
    realm: Partial<CallgentRealm> & { authType: string },
    servers: ServerObject[],
  ) {
    const authType = realm.authType;
    const processor = this._getAuthProcessor(authType);
    realm = processor.constructRealm(scheme, realm, entry, servers);
    const realmKey = realm.realmKey;
    const callgentId = entry.callgentId;
    const prisma = this.txHost.tx as PrismaClient;

    const where = realm.id
      ? { OR: [{ callgentId, realmKey }, { id: realm.id }] }
      : { callgentId, realmKey };
    const existing = await prisma.callgentRealm.findFirst({
      select: { pk: true },
      where,
    });
    if (existing)
      return prisma.callgentRealm.update({
        where: { pk: existing.pk },
        data: {
          ...realm,
          authType,
          realmKey,
          tenantPk_: undefined, // db default
          scheme: scheme as any,
          pricing: realm.pricing as any,
        },
      });

    return prisma.callgentRealm.create({
      data: {
        ...realm,
        id: Utils.uuid(),
        callgentId,
        realmKey,
        authType,
        provider: realm.provider,
        scheme: scheme as any,
        pricing: realm.pricing as any,
        tenantPk_: undefined,
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
    opBy: string,
  ) {
    let entry: EntryDto, targetService: EntriesService | EndpointsService;
    if (type == 'entry') {
      targetService = this.entriesService;
      entry = await this.entriesService.findOne(id, {
        pk: false,
        securities: true,
      });
    } else {
      targetService = this.endpointsService;
      const fun = await this.endpointsService.findOne(id, {
        entryId: true,
      });
      entry = fun && (await this.entriesService.findOne(fun.entryId));
    }
    if (!entry) throw new NotFoundException('Not found ' + type);
    if (opBy !== entry.createdBy)
      throw new ForbiddenException('Only creator can update securities');

    const secs = await Promise.all(
      securities.map(async (security) => {
        const realm = await this.findOne(security.realmId);
        if (!realm) throw new NotFoundException('Not found realm');

        const sec = this.constructSecurity(realm, entry, security.scopes);
        return { [sec.realmId]: sec };
      }),
    );

    return targetService.updateSecurities(id, secs).then((e) => !!e);
  }

  //// auth check start, auth config end ////

  /**
   * same as sep auth, except:
   * - token cannot be attached to request event
   * - uid is required as paidBy
   */
  @Transactional()
  async checkCenAuth(
    reqEvent: ClientRequestEvent,
  ): Promise<{ data: ClientRequestEvent; resumeFunName?: string }> {
    const cen = await this.entriesService.findOne(reqEvent.srcId, {
      securities: true,
      createdBy: true,
    });
    if (!cen)
      throw new NotFoundException(
        'Client entry not found, id: ' + reqEvent.srcId,
      );

    reqEvent.paidBy = cen.createdBy; // by default, creator paid
    return this.checkSecurities(reqEvent, cen.securities as any, true);
  }

  /**
   * check auth on the chosen endpoints.
   * automatically starts auth process to retrieve token.
   * may callback to cep for user credentials.
   */
  async checkSepAuth(
    endpoint: EndpointDto,
    reqEvent: ClientRequestEvent,
  ): Promise<{ data: ClientRequestEvent; resumeFunName?: string }> {
    try {
      const sepSecs = (endpoint as Endpoint).securities;
      if (sepSecs?.length) return this.checkSecurities(reqEvent, sepSecs);
    } catch (e) {
      if (!(e.status < 500)) this.logger.error(e);
      else this.logger.log(e.message);
    }

    const sen = await this.entriesService.findOne(endpoint.entryId, {
      securities: true,
    });
    return this.checkSecurities(reqEvent, sen.securities as any);
  }

  /**
   * @param [cen=false] if true[Client entry]: reqEvent.paidBy user must be identified
   * @throws UnauthorizedException if check fail, else ok/async
   */
  async checkSecurities(
    reqEvent: ClientRequestEvent,
    securities: RealmSecurityVO[],
    cen = false,
  ) {
    if (!securities?.length) return; // no auth, check ok
    // if sep, try attach first, or local first?
    // if (!cen)
    //   securities = securities.sort((a, b) =>
    //     a.attach ? (b.attach ? 0 : -1) : 1,
    //   );

    // returns on first check ok
    for (const security of securities) {
      reqEvent.context.security = security;
      try {
        return await this._checkSecurity(reqEvent, cen); // check ok/async
      } catch (e) {
        if (!(e.status < 500)) this.logger.error(e);
        else this.logger.log(e.message);
      }
    }

    // check auth failed
    throw new UnauthorizedException(
      `Check ${cen ? 'Client' : 'Service'} authentications failed.`,
    );
  }

  /**
   * @throws if check fail
   */
  @Transactional()
  protected async _checkSecurity(
    reqEvent: ClientRequestEvent,
    cen = false,
  ): Promise<{ data: ClientRequestEvent; resumeFunName?: string }> {
    const security: RealmSecurityVO = reqEvent.context.security;
    const items = Object.values(security);

    // FIXME and-relations for items list
    return this._checkSecurityItem(items[0], reqEvent, cen);
  }

  protected async _checkSecurityItem(
    item: RealmSecurityItem,
    reqEvent: ClientRequestEvent,
    cen = false,
  ) {
    reqEvent.context.securityItem = {
      ...item,
      attach: cen ? false : item.attach,
    };
    const { realm, processor } = await this._loadRealm(reqEvent);
    const { calledBy } = reqEvent;

    const localJwtAuth = realm.authType === 'jwt' && realm.provider === 'local';
    if (localJwtAuth && !calledBy)
      throw new UnauthorizedException('Auth failed. Payer not found.');

    const userIdentity = localJwtAuth
      ? // local.jwt just ref caller, prevents using others jwt
        { userId: calledBy, provider: 'local', credentials: '', uid: '' }
      : // read existing from identity store
        await this._findUserIdentity(reqEvent.context.req, realm, processor);

    // client auth requires userId as paidBy
    if (cen) {
      if (!userIdentity.userId)
        throw new UnauthorizedException('Client auth failed. Payer not found.');
      reqEvent.paidBy = userIdentity.userId;
    }

    // if localJwtAuth, need not check
    if (!localJwtAuth) {
      const ret = await processor.authProcess(
        reqEvent,
        realm,
        item,
        userIdentity,
      );
      if (ret?.resumeFunName) return ret; // async, not done
    }
    // auth check ok

    return this.postAuthProcess(reqEvent, realm);
  }

  /** delegate to auth processor  */
  async postAcquireSecret(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const { realm, processor } = await this._loadRealm(reqEvent);
    return processor.postAcquireSecret(reqEvent, realm);
  }

  /** delegate to auth processor  */
  async postExchangeToken(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const { realm, processor } = await this._loadRealm(reqEvent);
    return processor.postExchangeToken(reqEvent, realm);
  }

  /**
   * delegate to auth processor,
   * if valid, goon, if not start process, if unsure re-validate
   */
  async postValidateToken(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const { realm, processor } = await this._loadRealm(reqEvent);
    return processor.postValidateToken(reqEvent, realm);
  }

  /**
   * called after auth ok/or attached to req
   */
  async postAuthProcess(
    reqEvent: ClientRequestEvent,
    realm?: CallgentRealm,
  ): Promise<{ data: ClientRequestEvent; resumeFunName?: string }> {
    realm || ({ realm } = await this._loadRealm(reqEvent));
    delete reqEvent.context.securityItem;
    // TODO store new token/or bind to existing, better auto login the user

    // emit event for pricing, FIXME: cen needn't pricing
    await this.eventEmitter.emitAsync(
      PostAuthEvent.eventName,
      new PostAuthEvent(realm, reqEvent),
    );

    return;
  }

  private async _loadRealm(reqEvent: ClientRequestEvent) {
    const security: RealmSecurityItem = reqEvent.context.securityItem;
    const realm = security?.realmId && (await this._findOne(security.realmId));
    if (!realm)
      throw new UnauthorizedException('No context.securityItem found');
    const processor = this._getAuthProcessor(realm.authType);
    return { realm, processor };
  }

  protected async _findUserIdentity(
    req: any,
    realm: CallgentRealm,
    processor: AuthProcessor,
  ): Promise<{
    provider: string;
    uid: string;
    credentials: string;
    userId?: string;
  }> {
    const { provider, uid, credentials } = processor.getIdentity(req, realm);
    const identity =
      (await this.usersService.$findFirstUserIdentity(
        uid,
        provider,
        realm.authType,
      )) || {};
    return { provider, uid, credentials, ...identity };
  }

  /**
   * @param authType @see AuthType
   */
  protected _getAuthProcessor(authType: string): AuthProcessor {
    return this.moduleRef.get(authType + '-authProcessor');
  }

  @Transactional()
  protected _findOne(id: string, select?: Prisma.CallgentRealmSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.findUnique({
          select,
          where: { id },
        }),
      this.defSelect,
    ) as unknown as Promise<CallgentRealm>;
  }

  @Transactional()
  findOne(id: string, select?: Prisma.CallgentRealmSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.findUnique({
          select,
          where: { id },
        }),
      this.defSelect,
    ) as unknown as Promise<CallgentRealm>;
  }

  @Transactional()
  findAll(
    callgentId: string,
    {
      select,
      where = {},
      orderBy = { pk: 'desc' },
    }: {
      select?: Prisma.CallgentRealmSelect;
      where?: Prisma.CallgentRealmWhereInput;
      orderBy?: Prisma.CallgentRealmOrderByWithRelationInput;
    } = {},
  ) {
    where = where ? { callgentId } : { ...where, callgentId };
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
    id: string,
    dto: UpdateCallgentRealmDto,
    select?: Prisma.CallgentRealmSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const tenantPk_ = this.tenancyService.getTenantId();
    const old = await this.findOne(id, { pk: false, tenantPk_: true });
    if ((old as any)?.tenantPk_ !== tenantPk_) throw new NotFoundException();

    dto = { ...old, ...dto }; // merge
    if (!dto.scheme) throw new BadRequestException('realm.scheme is required');

    const processor = this._getAuthProcessor(dto.authType);
    dto = processor.constructRealm(dto.scheme, dto as any);

    return selectHelper(
      select,
      (select) =>
        prisma.callgentRealm.update({
          select,
          where: { id },
          data: {
            ...dto,
            scheme: dto.scheme as any,
            pricing: dto.pricing as any,
          },
        }),
      this.defSelect,
    );
  }

  @Transactional()
  async delete(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    const tenantPk_ = this.tenancyService.getTenantId();
    const realm = await prisma.callgentRealm.delete({
      where: { id, tenantPk_ },
      select: { callgentId: true },
    });
    if (!realm) return;
    const callgentId = realm.callgentId;

    // clear securities
    await Promise.all([
      prisma.$executeRaw`UPDATE "Entry"
    SET "securities" = (
        SELECT array_agg(sec::jsonb - ${id})
          FILTER (WHERE (sec::jsonb - ${id})::text != '{}')
        FROM unnest("securities") AS sec
    )
    WHERE "callgentId"=${callgentId} and EXISTS (
        SELECT 1
        FROM unnest("securities") AS elem
        WHERE elem::jsonb ? ${id}
    )`,
      prisma.$executeRaw`UPDATE "Endpoint"
    SET "securities" = (
        SELECT array_agg(sec::jsonb - ${id})
          FILTER (WHERE (sec::jsonb - ${id})::text != '{}')
        FROM unnest("securities") AS sec
    )
    WHERE "callgentId"=${callgentId} and EXISTS (
        SELECT 1
        FROM unnest("securities") AS elem
        WHERE elem::jsonb ? ${id}
    )`,
    ]);

    return realm;
  }
}
