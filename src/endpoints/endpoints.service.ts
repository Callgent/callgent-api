import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { EntryType, Prisma, PrismaClient } from '@prisma/client';
import { CallgentRealmsService } from '../callgent-realms/callgent-realms.service';
import { RealmSecurityVO } from '../callgent-realms/dto/realm-security.vo';
import { CallgentRealm } from '../callgent-realms/entities/callgent-realm.entity';
import { ApiSpec } from '../entries/adaptors/entry-adaptor.base';
import { EntryDto } from '../entries/dto/entry.dto';
import { EntriesService } from '../entries/entries.service';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class EndpointsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EntriesService')
    private readonly endpointsService: EntriesService,
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {}
  protected readonly defSelect: Prisma.EndpointSelect = {
    pk: false,
    tenantPk: false,
    rawJson: false,
    params: false,
    responses: false,
    callgentId: false,
    createdBy: false,
    deletedAt: false,
  };

  async loadEndpoints(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const { epName, callgentId } = reqEvent.data;

    // TODO if too many endpoints, use summary first
    const { data: eps } = await this.findMany({
      select: {
        createdAt: false,
        updatedAt: false,
        params: null,
        responses: null,
      },
      where: { callgentId: callgentId, name: epName },
      perPage: Number.MAX_SAFE_INTEGER,
    });
    if (!eps.length)
      throw new NotFoundException(
        `No service endpoints found on callgent#${callgentId}${
          epName ? ' name=' + epName : ''
        }`,
      );
    reqEvent.context.endpoints = eps as any[];
  }

  /**
   * a single function invocation. simple with no vars/flow controls/lambdas/parallels.
   * system callgents are involved: collection endpoints, timer, etc.
   */
  // protected async _invoke(
  //   taskAction: TaskActionDto,
  //   callgent: CallgentDto,
  //   endpoints: EndpointDto[],
  // ) {
  //   // FIXME task ctx msgs
  //   // 生成args映射方法，
  //   const { epName, mapping, question } = await this._mapping(
  //     taskAction,
  //     callgent.name,
  //     endpoints,
  //   );
  //   if (question) {
  //     // invoke event owner for more request info
  //     // this.eventEmitter.addListener;
  //     // this.eventEmitter.emit(
  //     //   ProgressiveRequestEvent.eventName,
  //     //   new ProgressiveRequestEvent(data),
  //     // );
  //   }

  //   const fun = endpoints.find((f) => f.name === epName);
  //   if (!fun) return; // FIXME

  //   // doInvoke
  // }

  @Transactional()
  async create(data: Prisma.EndpointUncheckedCreateInput) {
    const prisma = this.txHost.tx as PrismaClient;
    const id = Utils.uuid();
    return prisma.endpoint.create({ data: { ...data, id } });
  }

  @Transactional()
  async createBatch(entry: EntryDto, spec: ApiSpec, createdBy: string) {
    if (entry.type != 'SERVER')
      throw new BadRequestException(
        'entry must be of type `SERVER`, id=' + entry.id,
      );
    const { apis, securitySchemes, servers, securities } = spec;
    // TODO set entry.host from servers?

    // create callgent realms from securitySchemes
    const realmMap: { [name: string]: CallgentRealm } = {};
    if (securitySchemes) {
      await Promise.all(
        Object.entries(securitySchemes).map(async ([name, scheme]) => {
          const realm = await this.callgentRealmsService.upsertRealm(
            entry,
            scheme,
            {},
            servers,
          );
          realmMap[name] = realm as any;
        }),
      );
    }

    // validation
    const actMap = apis.map<Prisma.EndpointUncheckedCreateInput>(
      (f) => {
        const ret = {
          ...f,
          id: Utils.uuid(),
          name: Utils.formalApiName(f.method, f.path),
          entryId: entry.id,
          callgentId: entry.callgentId,
          createdBy: createdBy,
        };
        if (securities?.length || ret.securities?.length) {
          const securitiesMerged = [
            ...(securities || []),
            ...(ret.securities || []),
          ].map((security) => {
            const result: RealmSecurityVO = {};
            Object.entries(security).forEach(([name, scopes]) => {
              const realm = realmMap[name];
              if (!Number.isFinite(realm?.pk))
                throw new BadRequestException(
                  'Unknown security scheme name: ' + name,
                );
              const item = this.callgentRealmsService.constructSecurity(
                realm,
                entry,
                scopes,
              );

              result['' + item.realmPk] = item;
            });
            return result;
          });
          ret.securities = securitiesMerged as any;
        }
        return ret;
      },
    );

    // create api endpoints
    const prisma = this.txHost.tx as PrismaClient;
    const { count: actionsCount } = await prisma.endpoint.createMany({
      data: actMap,
    });

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
  async importBatch(
    entry: EntryDto,
    apiTxt: { text: string; format?: 'json' | 'yaml' | 'text' },
    createdBy: string,
  ) {
    if (entry?.type != EntryType.SERVER)
      throw new BadRequestException(
        'Function entries can only be imported into Server Entry. ',
      );

    const apiSpec = await this.endpointsService.parseApis(entry, apiTxt);
    return this.createBatch(entry, apiSpec, createdBy);
  }

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

  findAll({
    select,
    where,
    orderBy,
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
  delete(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.endpoint.delete({ select, where: { id } }),
    );
  }

  @Transactional()
  update(dto: UpdateEndpointDto) {
    if (!dto.id) return;
    dto.name = Utils.formalApiName(dto.method, dto.path);
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.endpoint.update({
        select,
        where: { id: dto.id },
        data: dto as any,
      }),
    );
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
