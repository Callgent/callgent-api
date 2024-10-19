import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { EventObject } from '../event-listeners/event-object';
import { Utils } from '../infra/libs/utils';

@Injectable()
export class EventStoresService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  /** load all events of taskId if not empty */
  async loadTargetEvents(event: EventObject) {
    const { id, taskId } = event;
    if (!taskId) return;

    const prisma = this.txHost.tx as PrismaClient;
    const es = await prisma.eventStore.findMany({
      select: { id: true, eventType: true, dataType: true, data: true }, // TODO, what to select
      where: { AND: [{ NOT: { id } }, { taskId }] },
      orderBy: { id: 'asc' },
    });
    if (!es?.length)
      throw new NotFoundException('Invalid event.taskId: ' + taskId);
    event.context.tgtEvents = es;
  }

  findOne(eventId: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventStore.findUnique({
      where: { id: eventId },
    });
  }

  @Transactional()
  upsertEvent(
    event: EventObject,
    funName: string,
    listenerId: string,
    statusCode: number,
  ) {
    if (statusCode === 0) {
      // if event success, keep the latest listenerId and funName
      funName || (funName = undefined);
      listenerId || (listenerId = undefined);
    }
    if (!event.taskId) event.taskId = event.id;

    const prisma = this.txHost.tx as PrismaClient;
    const data: Prisma.EventStoreCreateInput = {
      ...event,
      funName,
      listenerId,
    };
    return prisma.eventStore.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    });
  }
}
