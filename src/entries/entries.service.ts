import {
  Propagation,
  TransactionHost,
  Transactional,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  InjectionToken,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntryType, Prisma, PrismaClient } from '@prisma/client';
import { RealmSecurityVO } from '../callgent-realms/dto/realm-security.vo';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { Optional, Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';
import { EntryAdaptor } from './adaptors/entry-adaptor.base';
import { IS_CALLGENT_ENDPOINT_ADAPTOR } from './adaptors/entry-adaptor.decorator';
import { EntryDto } from './dto/entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { ClientRequestEvent } from './events/client-request.event';
import { EntriesChangedEvent } from './events/entries-changed.event';

@Injectable()
export class EntriesService implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(ModulesContainer)
    private readonly modulesContainer: ModulesContainer,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tenancyService: PrismaTenancyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  protected readonly defSelect: Prisma.EntrySelect = {
    pk: false,
    tenantPk: false,
    createdBy: false,
    deletedAt: false,
  };
  private serverAdaptorsList = {};
  private clientAdaptorsList = {};

  onModuleInit() {
    const modules = [...this.modulesContainer.values()];

    for (const nestModule of modules) {
      for (const [serviceKey, provider] of nestModule.providers) {
        if (!provider.metatype) continue;
        const name = Reflect.getMetadata(
          IS_CALLGENT_ENDPOINT_ADAPTOR,
          provider.metatype,
        );
        if (name?.indexOf(':') > 0) {
          const [key, type] = name.split(/:(?=[^:]*$)/);
          if (type == 'server' || type == 'both') {
            this._add2AdaptorsList(key, serviceKey, false);
          }
          if (type == 'client' || type == 'both') {
            this._add2AdaptorsList(key, serviceKey, true);
          }
        }
      }
    }
  }

  private _add2AdaptorsList(
    key: string,
    adaptorKey: InjectionToken,
    client: boolean,
  ) {
    const list = client ? this.clientAdaptorsList : this.serverAdaptorsList;
    if (key in list)
      throw new Error(
        `Conflict entry adaptor key ${key}:[${String(adaptorKey)}, ${
          list[key]
        }]`,
      );
    list[key] = adaptorKey;
  }

  list(client: boolean) {
    return Object.keys(
      client ? this.clientAdaptorsList : this.serverAdaptorsList,
    );
  }

  findOne(id: string, select?: Prisma.EntrySelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) => prisma.entry.findUnique({ select, where: { id } }),
      this.defSelect,
    );
  }

  findFirstByType(
    type: EntryType,
    callgentId: string,
    adaptorKey: string,
    id?: string,
  ) {
    id || (id = undefined);
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.entry.findFirst({
      where: { callgentId, adaptorKey, type, id },
      orderBy: { priority: 'desc' },
    });
  }

  /** bypassTenancy before query, setTenantId after query */
  @Transactional()
  async $findFirstByType(
    type: EntryType,
    callgentId: string,
    adaptorKey: string,
    entryId?: string,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    await this.tenancyService.bypassTenancy(prisma);
    return this.findFirstByType(type, callgentId, adaptorKey, entryId).then(
      async (v) => {
        await this.tenancyService.bypassTenancy(prisma, false);
        v && this.tenancyService.setTenantId(v.tenantPk);
        return v;
      },
    );
  }

  @Transactional()
  findAll({
    select,
    where,
    orderBy = { pk: 'desc' },
  }: {
    select?: Prisma.EntrySelect;
    where?: Prisma.EntryWhereInput;
    orderBy?: Prisma.EntryOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.entry.findMany({
          where,
          select,
          orderBy,
        }),
      this.defSelect,
    );
  }

  getAdaptor(adaptorKey: string, endpointType?: EntryType): EntryAdaptor {
    const list =
      endpointType == 'SERVER'
        ? this.serverAdaptorsList
        : this.clientAdaptorsList;
    if (adaptorKey in list)
      return this.moduleRef.get(list[adaptorKey], { strict: false });

    if (endpointType === undefined && adaptorKey in this.serverAdaptorsList)
      return this.moduleRef.get(this.serverAdaptorsList[adaptorKey], {
        strict: false,
      });
  }

  @Transactional()
  async create(
    dto: Optional<Prisma.EntryUncheckedCreateInput, 'id' | 'host'>,
    select?: Prisma.EntrySelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const adaptor = this.getAdaptor(dto.adaptorKey, dto.type);
    if (!adaptor)
      throw new BadRequestException(
        'Invalid entry adaptor key=' + dto.adaptorKey,
      );

    dto.id = Utils.uuid();
    const data = dto as Prisma.EntryUncheckedCreateInput;

    adaptor.preCreate(data);

    return selectHelper(
      select,
      (select) =>
        prisma.entry.create({
          select,
          data,
        }),
      this.defSelect,
    );
  }

  @Transactional()
  update(id: string, dto: UpdateEntryDto, select?: Prisma.EntrySelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) => prisma.entry.update({ select, where: { id }, data: dto }),
      this.defSelect,
    );
  }

  @Transactional()
  async delete(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    const ret = await selectHelper(
      { pk: null },
      (select) => prisma.entry.delete({ select, where: { id } }),
      this.defSelect,
    );

    this.eventEmitter.emitAsync(
      EntriesChangedEvent.eventName,
      new EntriesChangedEvent({
        callgent: { id: ret.callgentId },
        olds: [ret],
      }),
    );
    return ret;
  }

  // @Transactional()
  // upsertEntryAuth(
  //   dto: Prisma.EntryAuthUncheckedCreateInput,
  //   entry: EntryDto,
  // ) {
  //   if (!entry) throw new BadRequestException('entry not found');
  //   if (entry.authType == 'NONE')
  //     throw new BadRequestException("auth type `NONE` needn't be set");
  //   else if (entry.authType == 'USER') {
  //     if (!dto.userKey)
  //       throw new BadRequestException(
  //         '`userKey` is required for auth type `USER`',
  //       );
  //   } else if (entry.authType == 'APP') dto.userKey = '';
  //   // else
  //   //   throw new BadRequestException('Invalid auth type: ' + entry.authType);
  //   dto.entryId = entry.id;

  //   const prisma = this.txHost.tx as PrismaClient;
  //   return selectHelper(this.defSelect as Prisma.EntryAuthSelect, (select) =>
  //     prisma.endpointAuth.upsert({
  //       select,
  //       where: {
  //         endpointId_userKey: {
  //           entryId: dto.entryId,
  //           userKey: dto.userKey,
  //         },
  //       },
  //       create: dto,
  //       update: dto,
  //     }),
  //   );
  // }

  @Transactional(Propagation.RequiresNew)
  async init(id: string, initParams: object) {
    return;
    const prisma = this.txHost.tx as PrismaClient;

    const entry = await this.findOne(id);
    if (entry) {
      const adaptor = this.getAdaptor(entry.adaptorKey, entry.type);
      if (adaptor) {
        // FIXME issue client token
        // const content = await (entry.type == 'SERVER'
        //   ? adaptor.initSender
        //   : adaptor.initReceiver)(initParams, entry as any);
        // if (content)
        //   prisma.entry.update({
        //     where: { id },
        //     data: { content },
        //   });
        // return content;
        return;
      }
      throw new NotFoundException(
        `Invalid entry adaptor, adaptorKey=${entry.adaptorKey}`,
      );
    }
    throw new NotFoundException(`Entry not found, id=${id}`);
  }

  /**
   * parse APIs to openAPI.json format
   * @see https://github.com/OAI/OpenAPI-Specification/blob/main/schemas/v3.0/schema.json
   */
  async parseApis(
    entry: EntryDto,
    apiTxt: { text: string; format?: 'json' | 'yaml' | 'text' },
  ) {
    const adaptor = this.getAdaptor(entry.adaptorKey, entry.type);
    // TODO read entry.components
    return adaptor.parseApis(apiTxt); //, entry.components);
  }

  /** preprocess req from cep, by adaptor */
  @Transactional()
  async preprocessClientRequest(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const adaptor = this.getAdaptor(reqEvent.dataType, EntryType.CLIENT);
    if (!adaptor)
      throw new Error(
        `Invalid adaptor ${reqEvent.dataType} from cep ${reqEvent.srcId}`,
      );

    const entry = await this.findOne(reqEvent.srcId);

    await adaptor.preprocess(reqEvent, entry as any);
  }

  @Transactional()
  async invokeSEP(reqEvent: ClientRequestEvent) {
    const { map2Endpoints, endpoints } = reqEvent.context;
    if (!map2Endpoints || !endpoints?.length)
      throw new Error('Failed to invoke, No mapping function found');

    const func = endpoints[0] as EndpointDto;
    const sen = await this.findOne(func.entryId, {
      id: true,
      name: true,
      type: true,
      adaptorKey: true,
      priority: true,
      host: true,
      content: true,
      callgentId: true,
      callgent: { select: { id: true, name: true } },
    });
    const adapter = sen && this.getAdaptor(sen.adaptorKey, EntryType.SERVER);
    if (!adapter) throw new Error('Failed to invoke, No SEP adaptor found');

    // may returns pending result
    return adapter
      .invoke(func, map2Endpoints.args, sen as any, reqEvent)
      .then((res) => {
        if (res && res.resumeFunName) return res;
        return this.postInvokeSEP((res && res.data) || reqEvent);
      });
  }

  /** called after pending invokeSEP, convert resp to formal object */
  @Transactional()
  async postInvokeSEP(reqEvent: ClientRequestEvent) {
    const {
      context: { endpoints, resp },
    } = reqEvent;
    if (!endpoints?.length)
      throw new Error('Failed to invoke, No mapping function found');

    const func = endpoints[0] as EndpointDto;
    const sep = await this.findOne(func.entryId, {
      id: true,
      name: true,
      type: true,
      adaptorKey: true,
      priority: true,
      host: true,
      content: true,
      callgentId: true,
      callgent: { select: { id: true, name: true } },
    });
    const adapter = sep && this.getAdaptor(sep.adaptorKey, EntryType.SERVER);
    if (!adapter) throw new Error('Failed to invoke, No SEP adaptor found');
    await adapter.postprocess(reqEvent, func);

    return { data: reqEvent }; // do nothing
  }

  @Transactional()
  async updateSecurities(id: string, securities: RealmSecurityVO[]) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.entry.update({
      where: { id },
      data: { securities: securities as any },
    });
  }
}
