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
import { UpdateCallgentFunctionDto } from './dto/update-callgent-function.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class CallgentFunctionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EntriesService')
    private readonly endpointsService: EntriesService,
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {}
  protected readonly defSelect: Prisma.CallgentFunctionSelect = {
    pk: false,
    tenantPk: false,
    rawJson: false,
    params: false,
    responses: false,
    callgentId: false,
    createdBy: false,
    deletedAt: false,
  };

  async loadFunctions(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const { funName, callgentId } = reqEvent.data;

    // TODO if too many functions, use summary first
    const { data: funcs } = await this.findMany({
      select: {
        createdAt: false,
        updatedAt: false,
        params: null,
        responses: null,
      },
      where: { callgentId: callgentId, name: funName },
      perPage: Number.MAX_SAFE_INTEGER,
    });
    if (!funcs.length)
      throw new NotFoundException(
        `No function found on callgent#${callgentId}${
          funName ? ' name=' + funName : ''
        }`,
      );
    reqEvent.context.functions = funcs as any[];
  }

  /**
   * a single function invocation. simple with no vars/flow controls/lambdas/parallels.
   * system callgents are involved: collection functions, timer, etc.
   */
  // protected async _invoke(
  //   taskAction: TaskActionDto,
  //   callgent: CallgentDto,
  //   callgentFunctions: CallgentFunctionDto[],
  // ) {
  //   // FIXME task ctx msgs
  //   // 生成args映射方法，
  //   const { funName, mapping, question } = await this._mapping(
  //     taskAction,
  //     callgent.name,
  //     callgentFunctions,
  //   );
  //   if (question) {
  //     // invoke event owner for more request info
  //     // this.eventEmitter.addListener;
  //     // this.eventEmitter.emit(
  //     //   ProgressiveRequestEvent.eventName,
  //     //   new ProgressiveRequestEvent(data),
  //     // );
  //   }

  //   const fun = callgentFunctions.find((f) => f.name === funName);
  //   if (!fun) return; // FIXME

  //   // doInvoke
  // }

  @Transactional()
  async create(data: Prisma.CallgentFunctionUncheckedCreateInput) {
    const prisma = this.txHost.tx as PrismaClient;
    const id = Utils.uuid();
    return prisma.callgentFunction.create({ data: { ...data, id } });
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
    const actMap = apis.map<Prisma.CallgentFunctionUncheckedCreateInput>(
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

    // create api functions
    const prisma = this.txHost.tx as PrismaClient;
    const { count: actionsCount } = await prisma.callgentFunction.createMany({
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
    select?: Prisma.CallgentFunctionSelect;
    where?: Prisma.CallgentFunctionWhereInput;
    orderBy?: Prisma.CallgentFunctionOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.callgentFunction,
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
    select?: Prisma.CallgentFunctionSelect;
    where?: Prisma.CallgentFunctionWhereInput;
    orderBy?: Prisma.CallgentFunctionOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) => prisma.callgentFunction.findMany({ where, select, orderBy }),
      this.defSelect,
    );
  }

  @Transactional()
  delete(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgentFunction.delete({ select, where: { id } }),
    );
  }

  @Transactional()
  update(dto: UpdateCallgentFunctionDto) {
    if (!dto.id) return;
    dto.name = Utils.formalApiName(dto.method, dto.path);
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgentFunction.update({
        select,
        where: { id: dto.id },
        data: dto as any,
      }),
    );
  }

  findOne(id: string, select?: Prisma.CallgentFunctionSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.callgentFunction.findUnique({
          select,
          where: { id },
        }),
      this.defSelect,
    );
  }

  @Transactional()
  async updateSecurities(id: string, securities: RealmSecurityVO[]) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.callgentFunction.update({
      where: { id },
      data: { securities: securities as any },
    });
  }
}
