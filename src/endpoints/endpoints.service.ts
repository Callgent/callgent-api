import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  Inject,
  Injectable,
  InjectionToken,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
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
          const [key, type] = name.split(/:[^:]+$/);
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
  update(uuid: string, dto: UpdateEndpointDto) {
    throw new Error('Method not implemented.');
  }

  @Transactional()
  create(endpointKey: string, botletUuid: string, dto: CreateEndpointDto) {
    throw new Error('Method not implemented.');
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
