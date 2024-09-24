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
  NotImplementedException,
} from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { EndpointType, Prisma, PrismaClient } from '@prisma/client';
import { CallgentFunctionDto } from '../callgent-functions/dto/callgent-function.dto';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';
import { EndpointAdaptor } from './adaptors/endpoint-adaptor.base';
import { IS_CALLGENT_ENDPOINT_ADAPTOR } from './adaptors/endpoint-adaptor.decorator';
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

  findOne(id: string, select?: Prisma.EndpointSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) => prisma.endpoint.findUnique({ select, where: { id } }),
      this.defSelect,
    );
  }

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
    endpointId?: string,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    return this.tenancyService.bypassTenancy(prisma).then(() =>
      this.findFirstByType(type, callgentId, adaptorKey, endpointId).then(
        async (v) => {
          v && this.tenancyService.setTenantId(v.tenantPk);
          await this.tenancyService.bypassTenancy(prisma, false);
          return v;
        },
      ),
    );
  }

  @Transactional()
  findAll({
    select,
    where,
    orderBy = { pk: 'desc' },
  }: {
    select?: Prisma.EndpointSelect;
    where?: Prisma.EndpointWhereInput;
    orderBy?: Prisma.EndpointOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.endpoint.findMany({
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
    throw new NotImplementedException('Method not implemented.');
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

  /**
   * parse APIs to openAPI.json format
   * @see https://github.com/OAI/OpenAPI-Specification/blob/main/schemas/v3.0/schema.json
   */
  async parseApis(
    endpoint: EndpointDto,
    apiTxt: { text: string; format?: 'json' | 'yaml' | 'text' },
  ) {
    const adaptor = this.getAdaptor(endpoint.adaptorKey, endpoint.type);
    // TODO read endpoint.components
    return adaptor.parseApis(apiTxt); //, endpoint.components);
  }

  /** preprocess req from cep, by adaptor */
  @Transactional()
  async preprocessClientRequest(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const adaptor = this.getAdaptor(reqEvent.dataType, EndpointType.CLIENT);
    if (!adaptor)
      throw new Error(
        `Invalid adaptor ${reqEvent.dataType} from cep ${reqEvent.srcId}`,
      );

    const endpoint = await this.findOne(reqEvent.srcId);

    await adaptor.preprocess(reqEvent, endpoint as any);
  }

  @Transactional()
  async invokeSEP(reqEvent: ClientRequestEvent) {
    const { map2Function, functions } = reqEvent.context;
    if (!map2Function || !functions?.length)
      throw new Error('Failed to invoke, No mapping function found');

    const func = functions[0] as CallgentFunctionDto;
    const sep = await this.findOne(func.endpointId, {
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
    const adapter = sep && this.getAdaptor(sep.adaptorKey, EndpointType.SERVER);
    if (!adapter) throw new Error('Failed to invoke, No SEP adaptor found');

    // may returns pending result
    return adapter
      .invoke(func, map2Function.args, sep as any, reqEvent)
      .then((res) => {
        if (res && res.resumeFunName) return res;
        return this.postInvokeSEP((res && res.data) || reqEvent);
      });
  }

  /** called after pending invokeSEP, convert resp to formal object */
  @Transactional()
  async postInvokeSEP(reqEvent: ClientRequestEvent) {
    const {
      context: { functions, resp },
    } = reqEvent;
    if (!functions?.length)
      throw new Error('Failed to invoke, No mapping function found');

    const func = functions[0] as CallgentFunctionDto;
    const sep = await this.findOne(func.endpointId, {
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
    const adapter = sep && this.getAdaptor(sep.adaptorKey, EndpointType.SERVER);
    if (!adapter) throw new Error('Failed to invoke, No SEP adaptor found');
    await adapter.postprocess(reqEvent, func);

    return { data: reqEvent }; // do nothing
  }
}
