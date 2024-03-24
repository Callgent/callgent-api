import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  InjectionToken,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { EndpointDto } from './dto/endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { IS_BOTLET_ENDPOINT_SERVICE } from './endpoint-service.decorator';
import { EndpointInterface } from './endpoint.interface';

@Injectable()
export class EndpointsService {
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(ModulesContainer) private modulesContainer: ModulesContainer,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}
  protected readonly defSelect: Prisma.EndpointSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };
  private sendersList = {};
  private receiversList = {};

  onModuleInit() {
    const modules = [...this.modulesContainer.values()];

    for (const nestModule of modules) {
      for (const [serviceKey, provider] of nestModule.providers) {
        if (!provider.metatype) continue;
        const name = Reflect.getMetadata(
          IS_BOTLET_ENDPOINT_SERVICE,
          provider.metatype,
        );
        if (name?.indexOf(':') > 0) {
          const [key, type] = name.split(/:(?=[^:]*$)/);
          if (type == 'sender' || type == 'both') {
            this._add2ServiceList(key, serviceKey, false);
          }
          if (type == 'receiver' || type == 'both') {
            this._add2ServiceList(key, serviceKey, true);
          }
        }
      }
    }
  }

  private _add2ServiceList(
    key: string,
    serviceKey: InjectionToken,
    receiver: boolean,
  ) {
    const list = receiver ? this.receiversList : this.sendersList;
    if (key in list)
      throw new Error(
        `Conflict endpoint key ${key}:[${String(serviceKey)}, ${list[key]}]`,
      );
    list[key] = serviceKey;
  }

  list(receiver: boolean) {
    return Object.keys(receiver ? this.receiversList : this.sendersList);
  }

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.endpoint.findUnique({ where: { uuid } });
  }

  /**
   * @param receiver undefined: both, false: sender, true: receiver
   */
  getService(endpointKey: string, receiver?: boolean): EndpointInterface {
    const list = receiver ? this.receiversList : this.sendersList;
    if (endpointKey in list)
      return this.moduleRef.get(list[endpointKey], { strict: true });

    if (receiver === undefined && endpointKey in this.receiversList)
      return this.moduleRef.get(this.receiversList[endpointKey], {
        strict: true,
      });
  }

  @Transactional()
  async create(
    dto: Omit<Prisma.EndpointUncheckedCreateInput, 'uuid' | 'reqParamTemplate'>,
    select?: Prisma.EndpointSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const service = this.getService(dto.typeKey, dto.receiver);
    if (!service)
      throw new BadRequestException('Endpoint type not found: ' + dto.typeKey);

    const uuid = Utils.uuid();
    return selectHelper(
      select,
      (select) =>
        prisma.endpoint.create({
          select,
          data: { ...dto, uuid },
        }),
      this.defSelect,
    );
  }

  @Transactional()
  update(uuid: string, dto: UpdateEndpointDto) {
    throw new Error('Method not implemented.');
  }

  @Transactional()
  upsertEndpointAuth(
    dto: Prisma.EndpointAuthUncheckedCreateInput,
    endpoint: EndpointDto,
  ) {
    if (endpoint.authType == 'NONE')
      throw new BadRequestException("auth type `NONE` needn't be set");
    else if (endpoint.authType == 'USER') {
      if (!dto.userKey)
        throw new BadRequestException(
          '`userKey` is required for auth type `USER`',
        );
    } else if (endpoint.authType == 'APP') dto.userKey = '';
    // else
    //   throw new BadRequestException('Invalid auth type: ' + endpoint.authType);
    dto.endpointUuid = endpoint.uuid;

    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect as Prisma.EndpointAuthSelect, (select) =>
      prisma.endpointAuth.upsert({
        select,
        where: {
          endpointUuid_userKey: {
            endpointUuid: dto.endpointUuid,
            userKey: dto.userKey,
          },
        },
        create: dto,
        update: dto,
      }),
    );
  }

  @Transactional()
  async init(uuid: string, initParams: object) {
    const prisma = this.txHost.tx as PrismaClient;

    const endpoint = await this.findOne(uuid);
    if (endpoint) {
      const service = this.getService(endpoint.typeKey, endpoint.receiver);
      if (service) {
        const content = await (endpoint.receiver
          ? service.initReceiver
          : service.initSender)(initParams, endpoint as any);
        if (content)
          prisma.endpoint.update({
            where: { uuid },
            data: { content },
          });
        return content;
      }
    }
    throw new NotFoundException(`Endpoint not found, uuid=${uuid}`);
  }
}
