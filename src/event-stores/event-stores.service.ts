import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import { Prisma, PrismaClient } from '@prisma/client';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EventObject } from '../event-listeners/event-object';
import { selectHelper } from '../infras/repo/select.helper';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class EventStoresService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}
  defSelect: Prisma.EventStoreSelect = {
    id: true,
    calledBy: true,
    paidBy: true,
    title: true,
    taskId: true,
    eventType: true,
    dataType: true,
    statusCode: true,
    message: true,
    createdAt: true,
    updatedAt: true,
  };

  /** load all events of taskId if not empty */
  async loadClientEventHistories(event: ClientRequestEvent) {
    const { id, taskId } = event;
    if (!taskId) return;

    const prisma = this.txHost.tx as PrismaClient;
    const es = await prisma.eventStore.findMany({
      select: {
        id: true,
        dataType: true,
        context: true,
        statusCode: true,
        message: true,
      },
      where: {
        AND: [{ NOT: { id } }, { taskId }, { eventType: 'CLIENT_REQUEST' }],
      },
      orderBy: { pk: 'asc' },
    });
    if (es?.length) event.histories = es as any[]; // current event is not included
  }

  findOne(eventId: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventStore.findUnique({
      where: { id: eventId },
    });
  }

  @Transactional()
  upsertEvent(event: EventObject, funName: string, listenerId: string) {
    if (event.statusCode === 0) {
      // if event success, keep the latest listenerId and funName
      funName || (funName = undefined);
      listenerId || (listenerId = undefined);
    }

    const prisma = this.txHost.tx as PrismaClient;
    const data: Prisma.EventStoreCreateInput = {
      ...event,
      context: event.context,
      stopPropagation: event.stopPropagation,
      funName,
      listenerId,
    };
    return prisma.eventStore.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    });
  }

  @Transactional()
  findMany({
    select,
    where,
    orderBy = [{ pk: 'desc' }],
    page,
    perPage,
  }: {
    select?: Prisma.EventStoreSelect;
    where?: Prisma.EventStoreWhereInput;
    orderBy?: Prisma.EventStoreOrderByWithRelationInput[];
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.eventStore,
          {
            select,
            where,
            orderBy,
          },
          { page, perPage },
        );
        return result;
      },
      this.defSelect,
      'data',
    );
  }

  @Transactional()
  async findManyTasks({
    select,
    where,
    orderBy = [{ pk: 'desc' }],
    page = 1,
    perPage = 10,
  }: {
    select?: Prisma.EventStoreSelect;
    where: Prisma.EventStoreWhereInput;
    orderBy?: Prisma.EventStoreOrderByWithRelationInput[];
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    select = select ? { ...this.defSelect, ...select } : this.defSelect;

    const sqlWhere = this._whereToSql(where);
    const [{ c }]: [{ c: bigint }] =
      await prisma.$queryRaw`select count(distinct "taskId") as c from "EventStore" ${sqlWhere}`;
    if (!c) return { data: [], meta: { total: 0, perPage, currentPage: page } };

    const sqlOrder = orderBy?.length
      ? Prisma.sql`${Prisma.join(
          orderBy.map((o) => {
            const key = Object.keys(o)[0];
            return Prisma.sql`${Prisma.raw(key)} ${Prisma.raw(o[key])}`;
          }),
          ',',
        )}`
      : Prisma.sql`pk DESC`;
    const pks: { pk: bigint }[] =
      await prisma.$queryRaw`select min("pk") as pk from "EventStore"
      ${sqlWhere} group by "taskId" ORDER BY ${sqlOrder}
      limit ${perPage} offset ${perPage * (page - 1)}`;
    const data = await prisma.eventStore.findMany({
      select,
      where: { pk: { in: pks.map((x) => x.pk) } },
    });
    const meta = {
      total: Number(c),
      lastPage: Math.ceil(Number(c) / perPage),
      currentPage: page,
      perPage,
      prev: page > 1 ? page - 1 : null,
      next: page < Math.ceil(Number(c) / perPage) ? page + 1 : null,
    };

    return { data, meta };
  }

  private _whereToSql(where: Prisma.EventStoreWhereInput): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    Object.entries(where).forEach(([key, value]) => {
      // if undefined
      if (value === undefined) return;
      if (typeof value === 'object' && value !== null) {
        if ('contains' in value) {
          conditions.push(
            Prisma.sql`${Prisma.raw(key)} ILIKE '%' || ${value.contains} || '%'`,
          );
        } else if ('startsWith' in value) {
          conditions.push(
            Prisma.sql`${Prisma.raw(key)} ILIKE ${value.startsWith} || '%'`,
          );
        } else if ('endsWith' in value) {
          conditions.push(
            Prisma.sql`${Prisma.raw(key)} ILIKE '%' || ${value.endsWith}`,
          );
        } else {
          throw new Error('Unsupported operator');
        }
      } else {
        conditions.push(Prisma.sql`"${Prisma.raw(key)}" = ${value}`);
      }
    });

    return conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.sql``;
  }
}
