import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Callgent, Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';
import { CreateCallgentDto } from './dto/create-callgent.dto';
import { UpdateCallgentDto } from './dto/update-callgent.dto';
import { CallgentCreatedEvent } from './events/callgent-created.event';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class CallgentsService {
  private readonly logger = new Logger(CallgentsService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenancyService: PrismaTenancyService,
  ) {}
  protected readonly defSelect: Prisma.CallgentSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async create(
    dto: CreateCallgentDto,
    createdBy: string,
    select?: Prisma.CallgentSelect,
  ) {
    const data = dto as Prisma.CallgentUncheckedCreateInput;
    (data.uuid = Utils.uuid()), (data.createdBy = createdBy);

    const prisma = this.txHost.tx as PrismaClient;
    const ret: Callgent = await selectHelper(
      select,
      (select) => prisma.callgent.create({ select, data }),
      this.defSelect,
    );
    await this.eventEmitter.emitAsync(
      CallgentCreatedEvent.eventName,
      new CallgentCreatedEvent({ ...data, ...ret }),
    );
    return ret;
  }

  @Transactional()
  findAll({
    select,
    where,
    orderBy = { id: 'desc' },
    page,
    perPage,
  }: {
    select?: Prisma.CallgentSelect;
    where?: Prisma.CallgentWhereInput;
    orderBy?: Prisma.CallgentOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.callgent,
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

  @Transactional()
  async findMany(uuids: string[], select?: Prisma.CallgentSelect) {
    const prisma = this.txHost.tx as PrismaClient;

    const callgents = await selectHelper(
      select,
      async (select) =>
        await prisma.callgent.findMany({
          where: { uuid: { in: uuids } },
          select,
        }),
      this.defSelect,
    );

    if (callgents.length != uuids.length)
      throw new NotFoundException(
        `Callgent not found, uuid=${uuids
          .filter((x) => !callgents.find((y) => y.uuid == x))
          .join(', ')}`,
      );
    return callgents;
  }

  @Transactional()
  delete(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgent.delete({ select, where: { uuid } }),
    );
  }

  @Transactional()
  update(dto: UpdateCallgentDto) {
    if (!dto.uuid) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgent.update({
        select,
        where: { uuid: dto.uuid },
        data: dto,
      }),
    );
  }

  @Transactional()
  findOne(uuid: string, select?: Prisma.CallgentSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.callgent.findUnique({
          select,
          where: { uuid },
        }),
      this.defSelect,
    );
  }

  @Transactional()
  async duplicateOverTenancy(
    dupUuid: string,
    dto: CreateCallgentDto,
    createdBy: string,
  ) {
    const prisma = this.txHost.tx as PrismaClient;

    await this.tenancyService.bypassTenancy(prisma);
    const dup = await prisma.callgent.findUnique({ where: { uuid: dupUuid } });
    if (!dup)
      throw new NotFoundException('callgent to duplicate not found: ' + dupUuid);

    await this.tenancyService.bypassTenancy(prisma, false);
    const callgent = await this.create(dto, createdBy, { id: null });
  }

  /**
   * Cross tenancy execution when client endpoint is provided.
   * [endpoint://]callgent.please('act', with_args)
   * @param act API action name
   * @param endpoint client endpoint to call API. unnecessary in internal calls
   */
  @Transactional()
  async please(
    act: string,
    args: any[],
    endpoint: { callgentUuid: string; uuid?: string; adaptorKey?: string },
  ) {
    // invoke callgent action api, through endpoint
    const prisma = this.txHost.tx as PrismaClient;
    const withEndpoint = endpoint?.uuid || endpoint?.adaptorKey;

    // load targets
    if (withEndpoint) this.tenancyService.bypassTenancy(prisma);
    const [callgent, actions, epClient] = await Promise.all([
      prisma.callgent.findUnique({ where: { uuid: endpoint.callgentUuid } }),
      prisma.callgentFunction.findMany({
        where: { name: act, callgentUuid: endpoint.callgentUuid },
      }),
      withEndpoint &&
        prisma.endpoint.findFirst({ where: { ...endpoint, type: 'CLIENT' } }),
    ]);

    // check targets
    if (!callgent)
      throw new NotFoundException('callgent not found: ' + endpoint.callgentUuid);
    if (actions.length === 0)
      throw new NotFoundException(
        `callgent=${endpoint.callgentUuid} API action not found: ${act}`,
      );
    if (withEndpoint) {
      if (!epClient)
        throw new NotFoundException(
          `Client endpoint not found for callgent=${endpoint.callgentUuid}: ${
            endpoint.uuid || endpoint.adaptorKey
          }`,
        );
      this.tenancyService.setTenantId(callgent.tenantId);
      this.tenancyService.bypassTenancy(prisma, false);
    }

    let action;
    if (actions.length > 1) {
      // FIXME: match action by args
      action = actions[0];
    } else action = actions[0];

    // pre-meta, pre-routing, pre-mapping
  }
}
