import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Callgent, Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infras/libs/utils';
import { selectHelper } from '../infras/repo/select.helper';
import { AbacContextService } from '../infras/repo/abac/prisma-abac.service';
import { CreateCallgentDto } from './dto/create-callgent.dto';
import { UpdateCallgentDto } from './dto/update-callgent.dto';
import { CallgentCreatedEvent } from './events/callgent-created.event';
import { CallgentDeletedEvent } from './events/callgent-deleted.event';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class CallgentsService {
  private readonly logger = new Logger(CallgentsService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenancyService: AbacContextService,
  ) {}
  protected readonly defSelect: Prisma.CallgentSelect = {
    pk: false,
    tenantPk_: false,
    forkedPk: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async create(
    dto: CreateCallgentDto & { forkedPk?: bigint },
    createdBy: string,
    select?: Prisma.CallgentSelect,
  ) {
    const data = dto as Prisma.CallgentUncheckedCreateInput;
    (data.id = Utils.uuid()), (data.createdBy = createdBy), delete data.pk;
    // using db default: data.tenantPk_ = this.tenancyService.getTenantId();

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

    // await all handlers final results
    await this.eventEmitter.emitAsync(
      CallgentCreatedEvent.eventName,
      new CallgentCreatedEvent({ ...data, ...ret }),
    );
    return ret;
  }

  @Transactional()
  findManyByTenant({
    select,
    where,
    orderBy = [{ pk: 'desc' }],
    page,
    perPage,
  }: {
    select?: Prisma.CallgentSelect;
    where?: Prisma.CallgentWhereInput;
    orderBy?: Prisma.CallgentOrderByWithRelationInput[];
    page?: number;
    perPage?: number;
  }) {
    const tenantPk_ = this.tenancyService.getTenantId();
    where = where ? { ...where, tenantPk_ } : { tenantPk_ };
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
  async deleteByCreator(callgentId: string, createdBy: string) {
    const prisma = this.txHost.tx as PrismaClient;
    const c = await selectHelper(this.defSelect, (select) =>
      prisma.callgent.delete({ select, where: { id: callgentId, createdBy } }),
    );
    if (!c) return;

    await Promise.all([
      // directly delete entries, needn't EntriesChangedEvent
      prisma.entry.deleteMany({ where: { callgentId } }),
      // directly delete endpoints, needn't EndpointsChangedEvent
      prisma.endpoint.deleteMany({ where: { callgentId } }),
    ]);

    this.eventEmitter.emitAsync(
      CallgentDeletedEvent.eventName,
      new CallgentDeletedEvent(c),
    );

    return c;
  }

  @Transactional()
  updateByCreator(dto: UpdateCallgentDto, createdBy: string) {
    if (!dto.id) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.callgent.update({
        select,
        where: { id: dto.id, createdBy },
        data: dto,
      }),
    );
  }

  @Transactional()
  async findOne(id: string, select?: Prisma.CallgentSelect) {
    const prisma = this.txHost.tx as PrismaClient;

    try {
      await this.tenancyService.bypassAbac(prisma);
      const c = await selectHelper(
        select,
        (select) =>
          prisma.callgent.update({
            where: { id },
            select,
            data: { viewed: { increment: 1 } },
          }),
        this.defSelect,
      );
      return c;
    } catch (e) {
      if (e.message.includes(' not found.')) return null;
      throw e;
    } finally {
      await this.tenancyService.bypassAbac(prisma, false);
    }
  }

  async getByName(name: string, select?: Prisma.CallgentSelect) {
    const tenantPk_ = this.tenancyService.getTenantId();
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      { pk: false, ...select, deletedAt: true },
      (select) =>
        prisma.callgent.findUnique({
          select,
          where: {
            tenantPk__name_deletedAt: { tenantPk_, name, deletedAt: 0 },
          },
        }),
      this.defSelect,
    ).then((c) => {
      if (!c || c.deletedAt) return null;
      delete c.deletedAt;
      return c;
    });
  }
}
