import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Entry, EntryType, Prisma, PrismaClient } from '@prisma/client';
import { CallgentRealmsService } from '../callgent-realms/callgent-realms.service';
import { RealmSecurityVO } from '../callgent-realms/dto/realm-security.vo';
import { CallgentRealm } from '../callgent-realms/entities/callgent-realm.entity';
import { ApiSpec } from '../entries/adaptors/entry-adaptor.base';
import { EntryDto } from '../entries/dto/entry.dto';
import { EntriesService } from '../entries/entries.service';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { Optional, Utils } from '../infras/libs/utils';
import { selectHelper } from '../infras/repo/select.helper';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { Endpoint } from './entities/endpoint.entity';
import { EndpointsChangedEvent } from './events/endpoints-changed.event';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class EndpointsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  protected readonly defSelect: Prisma.EndpointSelect = {
    pk: false,
    rawJson: false,
    // params: false,
    // responses: false,
    // callgentId: false,
    securities: false,
    tenantPk_: false,
    createdBy: false,
    deletedAt: false,
  };

  async loadEndpoints(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const { epName, callgentId } = reqEvent.context;

    // TODO if too many endpoints, use summary first
    const { data: eps } = await this.findMany({
      select: {
        createdAt: false,
        updatedAt: false,
        params: true,
        responses: true,
      },
      where: { callgentId: callgentId, name: epName },
      perPage: Number.MAX_SAFE_INTEGER,
    });
    if (!eps.length)
      throw new NotFoundException(
        `No service endpoints found for callgent#${callgentId}${
          epName ? ' name=' + epName : ''
        }`,
      );
    reqEvent.context.endpoints = eps as any[];
  }

  @Transactional()
  async create(dto: CreateEndpointDto, opBy: string) {
    const prisma = this.txHost.tx as PrismaClient;
    const entry = await this.entriesService.findOne(dto.entryId, {
      id: true,
      summary: true,
      type: true,
      instruction: true,
      adaptorKey: true,
    });
    if (!entry) return;
    const adaptor = this.entriesService.getAdaptor(entry.adaptorKey, 'SERVER');
    const isAsync = adaptor.isAsync(dto as any);
    dto.operationId || (dto.operationId = dto.path);
    const name = Utils.formalApiName(dto.method, dto.operationId);
    const data: Prisma.EndpointUncheckedCreateInput = {
      ...dto,
      name,
      method: dto.method.toUpperCase(),
      isAsync,
      id: Utils.uuid(),
      adaptorKey: entry.adaptorKey,
      securities: [],
      createdBy: opBy,
      tenantPk_: undefined, // db default
    };

    const ep = await selectHelper(this.defSelect, (select) =>
      prisma.endpoint.create({ data, select }),
    );
    await this._pubEvent({ opBy, entry, news: [ep] });
    return ep;
  }

  protected async _pubEvent(data: {
    opBy: string;
    entry: {
      id: string;
      summary?: string;
      instruction?: string;
    };
    news?: Omit<Endpoint, 'securities' | 'createdAt'>[];
    olds?: Omit<Endpoint, 'securities' | 'createdAt'>[];
  }) {
    return this.eventEmitter.emitAsync(
      EndpointsChangedEvent.eventName,
      new EndpointsChangedEvent(data),
    );
  }

  @Transactional()
  async createBatch(entry: Entry, spec: ApiSpec, createdBy: string) {
    if (entry.type != 'SERVER')
      throw new BadRequestException(
        'entry must be of type `SERVER`, id=' + entry.id,
      );
    const entryDto = entry as unknown as EntryDto;

    const { apis, securitySchemes, servers, securities } = spec;
    // TODO set entry.host from servers?

    // create callgent realms from securitySchemes
    const realmMap: { [name: string]: CallgentRealm } = {};
    securitySchemes &&
      (await Promise.all(
        Object.entries(securitySchemes).map(async ([name, scheme]) => {
          delete (scheme as any).tenantPk_;
          const realm = await this.callgentRealmsService.upsertRealm(
            entryDto,
            scheme,
            { authType: scheme.type },
            servers,
          );
          realmMap[name] = realm as any;
        }),
      ));

    // validation
    const actMap = apis.map<
      Omit<Prisma.EndpointUncheckedCreateInput, 'isAsync'>
    >((f) => {
      const operationId = f.operationId || f.path;
      const name = Utils.formalApiName(f.method, operationId);
      const ret = {
        ...f,
        name,
        createdBy,
        id: Utils.uuid(),
        entryId: entry.id,
        operationId,
        adaptorKey: entry.adaptorKey,
        callgentId: entry.callgentId,
        tenantPk_: undefined, // db default
        servers: f.servers as any,
      };
      if (securities?.length || ret.securities?.length) {
        const securitiesMerged = [
          ...(securities || []),
          ...(ret.securities || []),
        ].map((security) => {
          const result: RealmSecurityVO = {};
          Object.entries(security).forEach(([name, scopes]) => {
            const realm = realmMap[name];
            if (!realm?.id)
              throw new BadRequestException(
                'Unknown security scheme name: ' + name,
              );
            const item = this.callgentRealmsService.constructSecurity(
              realm,
              entryDto,
              scopes,
            );

            result[item.realmId] = item;
          });
          return result;
        });
        ret.securities = securitiesMerged as any;
      }
      return ret;
    });

    // create api endpoints
    const actionsCount = this.createMany(actMap, entryDto, createdBy);

    // 根据adaptor，auth type，判定可选的auth servers
    // FIXME save securitySchemes on entry
    // await this.endpointsService.saveSecuritySchemes(
    //   entry.id,
    //   securitySchemes,
    // );
    // FIXME add auth-listener for this sep,

    return actionsCount;
  }

  @Transactional()
  async createMany(
    endpoints: Optional<Prisma.EndpointUncheckedCreateInput, 'isAsync'>[],
    entry: EntryDto,
    opBy: string,
  ) {
    const adaptor = this.entriesService.getAdaptor(
      entry.adaptorKey,
      EntryType.SERVER,
    );
    endpoints.forEach((e) => {
      e.isAsync = adaptor.isAsync(e as any);
      e.tenantPk_ = undefined; // db default
    });
    const data: Prisma.EndpointUncheckedCreateInput[] =
      endpoints as Prisma.EndpointUncheckedCreateInput[];
    const prisma = this.txHost.tx as PrismaClient;
    const { count } = await prisma.endpoint.createMany({ data });
    await this._pubEvent({ opBy, entry: entry as any, news: data as any[] });
    return count;
  }

  @Transactional()
  async importBatch(
    entry: Entry,
    apiTxt: { text: string; format?: 'json' | 'yaml' | 'text' },
    createdBy: string,
  ) {
    const apiSpec = await this.entriesService.parseApis(entry as any, apiTxt);
    return this.createBatch(entry, apiSpec, createdBy);
  }

  /** tenant irrelevant */
  findMany({
    select,
    where,
    orderBy = { pk: 'desc' },
    page,
    perPage,
  }: {
    select?: Prisma.EndpointSelect;
    where?: Prisma.EndpointWhereInput;
    orderBy?: Prisma.EndpointOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.endpoint,
          {
            select,
            where,
            orderBy,
          },
          {
            page,
            perPage,
          },
        );
        return result;
      },
      this.defSelect,
      'data',
    );
  }

  /** tenant irrelevant */
  findAll({
    select,
    where,
    orderBy = { pk: 'asc' },
  }: {
    select?: Prisma.EndpointSelect;
    where?: Prisma.EndpointWhereInput;
    orderBy?: Prisma.EndpointOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) => prisma.endpoint.findMany({ where, select, orderBy }),
      this.defSelect,
    );
  }

  @Transactional()
  async delete(id: string, opBy: string) {
    const prisma = this.txHost.tx as PrismaClient;
    const ret = await selectHelper(this.defSelect, (select) =>
      prisma.endpoint.delete({ select, where: { id, createdBy: opBy } }),
    );
    if (!ret) return;

    await this._pubEvent({ opBy, entry: { id: ret.entryId }, olds: [ret] });
    return ret;
  }

  @Transactional()
  async update(dto: UpdateEndpointDto, opBy: string) {
    if (!dto.id) return;
    const operationId = dto.operationId || dto.path;
    const name = Utils.formalApiName(dto.method, operationId);
    const prisma = this.txHost.tx as PrismaClient;
    const old = await this.findOne(dto.id, this.defSelect);
    const ret = await selectHelper(this.defSelect, (select) =>
      prisma.endpoint.update({
        select,
        where: { id: dto.id, createdBy: opBy },
        data: { ...dto, name, operationId },
      }),
    );
    if (!ret) return;

    await this._pubEvent({
      opBy,
      entry: { id: ret.entryId },
      news: [ret],
      olds: [old],
    });
    return ret;
  }

  findOne(id: string, select?: Prisma.EndpointSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.endpoint.findUnique({
          select,
          where: { id },
        }),
      this.defSelect,
    );
  }

  @Transactional()
  async updateSecurities(id: string, securities: RealmSecurityVO[]) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.endpoint.update({
      where: { id },
      data: { securities: securities as any },
    });
  }
}
