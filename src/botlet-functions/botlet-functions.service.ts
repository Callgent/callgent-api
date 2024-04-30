import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { BotletFunction, Prisma, PrismaClient } from '@prisma/client';
import { ApiSpec } from '../endpoints/adaptors/endpoint-adaptor.interface';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { ClientRequestEvent } from '../endpoints/events/client-request.event';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { UpdateBotletFunctionDto } from './dto/update-botlet-function.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class BotletFunctionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
  ) {}
  protected readonly defSelect: Prisma.BotletFunctionSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async loadFunctions(reqEvent: ClientRequestEvent) {
    const { funName, botletId } = reqEvent.data;

    // TODO if too many functions, use summary first
    const { data: funcs } = await this.findAll({
      select: { createdAt: false, updatedAt: false },
      where: { botletUuid: botletId, name: funName },
      perPage: Number.MAX_SAFE_INTEGER,
    });
    if (!funcs.length)
      throw new BadRequestException(
        `No function found on botlet#${botletId}${
          funName ? 'name=' + funName : ''
        }`,
      );
    reqEvent.context.functions = funcs as any[];
    return reqEvent;
  }

  /**
   * a single function invocation. simple with no vars/flow controls/lambdas/parallels.
   * system botlets are involved: collection functions, timer, etc.
   */
  // protected async _invoke(
  //   taskAction: TaskActionDto,
  //   botlet: BotletDto,
  //   botletFunctions: BotletFunctionDto[],
  // ) {
  //   // FIXME task ctx msgs
  //   // 生成args映射方法，
  //   const { funName, mapping, question } = await this._mapping(
  //     taskAction,
  //     botlet.name,
  //     botletFunctions,
  //   );
  //   if (question) {
  //     // invoke event owner for more request info
  //     // this.eventEmitter.addListener;
  //     // this.eventEmitter.emit(
  //     //   ProgressiveRequestEvent.eventName,
  //     //   new ProgressiveRequestEvent(data),
  //     // );
  //   }

  //   const fun = botletFunctions.find((f) => f.name === funName);
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
    const actMap = apis.map<Prisma.BotletFunctionUncheckedCreateInput>((e) => {
      return {
        ...e,
        uuid: Utils.uuid(),
        endpointUuid: endpoint.uuid,
        botletUuid: endpoint.botletUuid,
        createdBy: createdBy,
      };
    });

    const prisma = this.txHost.tx as PrismaClient;
    const { count: actionsCount } = await prisma.botletFunction.createMany({
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
    select?: Prisma.BotletFunctionSelect;
    where?: Prisma.BotletFunctionWhereInput;
    orderBy?: Prisma.BotletFunctionOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.botletFunction,
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
    select?: Prisma.BotletFunctionSelect;
    where?: Prisma.BotletFunctionWhereInput;
    orderBy?: Prisma.BotletFunctionOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.botletFunction.findMany({ ...args });
  }

  @Transactional()
  delete(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletFunction.delete({ select, where: { uuid } }),
    );
  }

  @Transactional()
  update(dto: UpdateBotletFunctionDto) {
    if (!dto.uuid) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletFunction.update({
        select,
        where: { uuid: dto.uuid },
        data: dto,
      }),
    );
  }

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletFunction.findUnique({
        select,
        where: { uuid },
      }),
    );
  }
}
