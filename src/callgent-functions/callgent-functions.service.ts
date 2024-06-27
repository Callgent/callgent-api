import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Prisma, PrismaClient } from '@prisma/client';
import { ApiSpec } from '../endpoints/adaptors/endpoint-adaptor.interface';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { ClientRequestEvent } from '../endpoints/events/client-request.event';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { UpdateCallgentFunctionDto } from './dto/update-callgent-function.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class CallgentFunctionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
  ) {}
  protected readonly defSelect: Prisma.CallgentFunctionSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async loadFunctions(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { event: ClientRequestEvent; callbackName?: string }> {
    const { funName, callgentId } = reqEvent.data;

    // TODO if too many functions, use summary first
    const { data: funcs } = await this.findAll({
      select: { createdAt: false, updatedAt: false },
      where: { callgentUuid: callgentId, name: funName },
      perPage: Number.MAX_SAFE_INTEGER,
    });
    if (!funcs.length)
      throw new BadRequestException(
        `No function found on callgent#${callgentId}${
          funName ? 'name=' + funName : ''
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
  async createBatch(endpoint: EndpointDto, spec: ApiSpec, createdBy: string) {
    if (endpoint.type != 'SERVER')
      throw new BadRequestException(
        'endpoint must be of type `SERVER`, uuid=' + endpoint.uuid,
      );

    const { apis } = spec;
    // validation
    const actMap = apis.map<Prisma.CallgentFunctionUncheckedCreateInput>(
      (e) => {
        return {
          ...e,
          uuid: Utils.uuid(),
          funName: e.name,
          documents: e.content.summary,
          fullCode: '',
          endpointUuid: endpoint.uuid,
          callgentUuid: endpoint.callgentUuid,
          createdBy: createdBy,
        };
      },
    );

    const prisma = this.txHost.tx as PrismaClient;
    const { count: actionsCount } = await prisma.callgentFunction.createMany({
      data: actMap,
    });
    return actionsCount;
  }

  @Transactional()
  async importBatch(
    endpoint: EndpointDto,
    apiTxt: { text: string; format?: string },
    createdBy: string,
  ) {
    const apis = await this.endpointsService.parseApis(endpoint, apiTxt);
    return this.createBatch(endpoint, apis, createdBy);
  }

  findAll({
    select,
    where,
    orderBy = { id: 'desc' },
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

  findMany(args: {
    select?: Prisma.CallgentFunctionSelect;
    where?: Prisma.CallgentFunctionWhereInput;
    orderBy?: Prisma.CallgentFunctionOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.callgentFunction.findMany({ ...args });
  }

  @Transactional()
  delete(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgentFunction.delete({ select, where: { uuid } }),
    );
  }

  @Transactional()
  update(dto: UpdateCallgentFunctionDto) {
    if (!dto.uuid) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgentFunction.update({
        select,
        where: { uuid: dto.uuid },
        data: dto,
      }),
    );
  }

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgentFunction.findUnique({
        select,
        where: { uuid },
      }),
    );
  }
}
