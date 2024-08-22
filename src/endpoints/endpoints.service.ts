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
} from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { EndpointType, Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';
import { IS_CALLGENT_ENDPOINT_ADAPTOR } from './adaptors/endpoint-adaptor.decorator';
import { EndpointAdaptor } from './adaptors/endpoint-adaptor.interface';
import { EndpointDto } from './dto/endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { ClientRequestEvent } from './events/client-request.event';

@Injectable()
export class EndpointsService {
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(ModulesContainer)
    private readonly modulesContainer: ModulesContainer,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tenancyService: PrismaTenancyService,
  ) {}
  protected readonly defSelect: Prisma.EndpointSelect = {
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
        `Conflict endpoint adaptor key ${key}:[${String(adaptorKey)}, ${
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

  @Transactional()
  findOne(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.endpoint.findUnique({ where: { id } });
  }

  @Transactional()
  findFirstByType(
    type: EndpointType,
    callgentId: string,
    adaptorKey: string,
    id?: string,
  ) {
    id || (id = undefined);
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.endpoint.findFirst({
      where: { callgentId, adaptorKey, type, id },
      orderBy: { priority: 'desc' },
    });
  }

  /** bypassTenancy before query, setTenantId after query */
  @Transactional()
  async $findFirstByType(
    type: EndpointType,
    callgentId: string,
    adaptorKey: string,
    endpoint?: string,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    return this.tenancyService.bypassTenancy(prisma).then(() =>
      this.findFirstByType(type, callgentId, adaptorKey, endpoint).then(
        async (v) => {
          v && this.tenancyService.setTenantId(v.tenantPk);
          await this.tenancyService.bypassTenancy(prisma, false);
          return v;
        },
      ),
    );
  }

  @Transactional()
  findOneAuth(id: string, userKey: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.endpointAuth.findUnique({
      where: {
        endpointId_userKey: { endpointId: id, userKey: userKey },
      },
    });
  }

  @Transactional()
  findAll({
    select,
    where,
    orderBy = { id: 'desc' },
  }: {
    select?: Prisma.EndpointSelect;
    where?: Prisma.EndpointWhereInput;
    orderBy?: Prisma.EndpointOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) =>
        await prisma.endpoint.findMany({
          where,
          select,
          orderBy,
        }),
      this.defSelect,
    );
  }

  getAdaptor(adaptorKey: string, endpointType?: EndpointType): EndpointAdaptor {
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
    dto: Omit<Prisma.EndpointUncheckedCreateInput, 'id'>,
    select?: Prisma.EndpointSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const service = this.getAdaptor(dto.adaptorKey, dto.type);
    if (!service)
      throw new BadRequestException(
        'Invalid endpoint adaptor key=' + dto.adaptorKey,
      );

    const id = Utils.uuid();
    // init ep name
    dto.host = dto.host.replace('{id}', id);
    dto.name || (dto.name = dto.host);

    return selectHelper(
      select,
      (select) =>
        prisma.endpoint.create({
          select,
          data: { ...dto, id },
        }),
      this.defSelect,
    );
  }

  @Transactional()
  update(id: string, dto: UpdateEndpointDto) {
    throw new Error('Method not implemented.');
  }

  @Transactional()
  delete(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.endpoint.delete({ select, where: { id } }),
    );
  }

  // @Transactional()
  // upsertEndpointAuth(
  //   dto: Prisma.EndpointAuthUncheckedCreateInput,
  //   endpoint: EndpointDto,
  // ) {
  //   if (!endpoint) throw new BadRequestException('endpoint not found');
  //   if (endpoint.authType == 'NONE')
  //     throw new BadRequestException("auth type `NONE` needn't be set");
  //   else if (endpoint.authType == 'USER') {
  //     if (!dto.userKey)
  //       throw new BadRequestException(
  //         '`userKey` is required for auth type `USER`',
  //       );
  //   } else if (endpoint.authType == 'APP') dto.userKey = '';
  //   // else
  //   //   throw new BadRequestException('Invalid auth type: ' + endpoint.authType);
  //   dto.endpointId = endpoint.id;

  //   const prisma = this.txHost.tx as PrismaClient;
  //   return selectHelper(this.defSelect as Prisma.EndpointAuthSelect, (select) =>
  //     prisma.endpointAuth.upsert({
  //       select,
  //       where: {
  //         endpointId_userKey: {
  //           endpointId: dto.endpointId,
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

    const endpoint = await this.findOne(id);
    if (endpoint) {
      const adaptor = this.getAdaptor(endpoint.adaptorKey, endpoint.type);
      if (adaptor) {
        // FIXME issue client token
        // const content = await (endpoint.type == 'SERVER'
        //   ? adaptor.initSender
        //   : adaptor.initReceiver)(initParams, endpoint as any);
        // if (content)
        //   prisma.endpoint.update({
        //     where: { id },
        //     data: { content },
        //   });
        // return content;
        return;
      }
      throw new NotFoundException(
        `Invalid endpoint adaptor, adaptorKey=${endpoint.adaptorKey}`,
      );
    }
    throw new NotFoundException(`Endpoint not found, id=${id}`);
  }

  async parseApis(
    endpoint: EndpointDto,
    apiTxt: { text: string; format?: string },
  ) {
    const adaptor = this.getAdaptor(endpoint.adaptorKey, endpoint.type);
    return adaptor.parseApis(apiTxt);
  }

  /** preprocess req from cep, by adaptor */
  @Transactional()
  async preprocessClientRequest(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { event: ClientRequestEvent; callbackName?: string }> {
    const adaptor = this.getAdaptor(reqEvent.dataType, EndpointType.CLIENT);
    if (!adaptor)
      throw new Error(
        `Invalid adaptor ${reqEvent.dataType} from cep ${reqEvent.srcId}`,
      );

    const endpoint = await this.findOne(reqEvent.srcId);

    await adaptor.preprocess(reqEvent, endpoint);
  }
}
