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
    pk: false,
    tenantPk: false,
    forkedPk: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async create(
    dto: CreateCallgentDto & { forkedPk?: number },
    createdBy: string,
    select?: Prisma.CallgentSelect,
  ) {
    const data = dto as Prisma.CallgentUncheckedCreateInput;
    (data.id = Utils.uuid()), (data.createdBy = createdBy), delete data.pk;

    const prisma = this.txHost.tx as PrismaClient;
    const ret: Callgent = await selectHelper(
      select,
      (select) => prisma.callgent.create({ select, data }),
      this.defSelect,
    );
    if (dto.mainTagId) {
      const tag = { callgentId: data.id, tagId: dto.mainTagId };
      await prisma.callgentTag.upsert({
        where: { callgentId_tagId: tag },
        create: tag,
        update: tag,
      });
    }

    await this.eventEmitter.emitAsync(
      CallgentCreatedEvent.eventName,
      new CallgentCreatedEvent({ ...data, ...ret }),
    );
    return ret;
  }

  @Transactional()
  findMany({
    select,
    where,
    orderBy = { pk: 'desc' },
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

  // async findAll(ids: string[], select?: Prisma.CallgentSelect) {
  //   const prisma = this.txHost.tx as PrismaClient;

  //   const callgents = await selectHelper(
  //     select,
  //     async (select) =>
  //       await prisma.callgent.findMany({
  //         where: { id: { in: ids } },
  //         select,
  //       }),
  //     this.defSelect,
  //   );

  //   if (callgents.length != ids.length)
  //     throw new NotFoundException(
  //       `Callgent not found, id=${ids
  //         .filter((x) => !callgents.find((y) => y.id == x))
  //         .join(', ')}`,
  //     );
  //   return callgents;
  // }

  @Transactional()
  delete(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgent.delete({ select, where: { id } }),
    );
  }

  @Transactional()
  update(dto: UpdateCallgentDto) {
    if (!dto.id) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgent.update({
        select,
        where: { id: dto.id },
        data: dto,
      }),
    );
  }

  @Transactional()
  async findOne(id: string, select?: Prisma.CallgentSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    await prisma.callgent.update({
      where: { id },
      select: { id: true },
      data: { viewed: { increment: 1 } },
    });
    return selectHelper(
      select,
      (select) =>
        prisma.callgent.findUnique({
          select,
          where: { id },
        }),
      this.defSelect,
    );
  }

  async getByName(name: string, select?: Prisma.CallgentSelect) {
    const tenantPk = this.tenancyService.getTenantId();
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      { ...select, deletedAt: null },
      (select) =>
        prisma.callgent.findUnique({
          select,
          where: { tenantPk_name: { tenantPk, name } },
        }),
      this.defSelect,
    ).then((c) => {
      if (!c || c.deletedAt) return null;
      delete c.deletedAt;
      return c;
    });
  }

  /**
   * Cross tenancy execution when client endpoint is provided.
   * [endpoint://]callgent.please('act', with_args)
   * @param act API action name
   * @param endpoint client endpoint to call API. unnecessary in internal calls
   * @deprecated
   */
  @Transactional()
  async please(
    act: string,
    args: any[],
    endpoint: { callgentId: string; id?: string; adaptorKey?: string },
  ) {
    // invoke callgent action api, through endpoint
    const prisma = this.txHost.tx as PrismaClient;
    const withEndpoint = endpoint?.id || endpoint?.adaptorKey;

    // load targets
    if (withEndpoint) this.tenancyService.bypassTenancy(prisma);
    const [callgent, actions, epClient] = await Promise.all([
      prisma.callgent.findUnique({ where: { id: endpoint.callgentId } }),
      prisma.callgentFunction.findMany({
        where: { name: act, callgentId: endpoint.callgentId },
      }),
      withEndpoint &&
        prisma.endpoint.findFirst({ where: { ...endpoint, type: 'CLIENT' } }),
    ]);

    // check targets
    if (!callgent)
      throw new NotFoundException('callgent not found: ' + endpoint.callgentId);
    if (actions.length === 0)
      throw new NotFoundException(
        `callgent=${endpoint.callgentId} API action not found: ${act}`,
      );
    if (withEndpoint) {
      if (!epClient)
        throw new NotFoundException(
          `Client endpoint not found for callgent=${endpoint.callgentId}: ${
            endpoint.id || endpoint.adaptorKey
          }`,
        );
      this.tenancyService.setTenantId(callgent.tenantPk);
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
